"""
Lambda handler — Laplacian-regularized GLM simulation (multi-dataset).

Fully-async design (multi-dataset compute + rendering exceeds the 29s API
Gateway limit, so nothing heavy runs synchronously):

  POST /run  (sync, API Gateway)
    - Parses params, mints a jobId, invokes itself asynchronously, returns
      { jobId } immediately.

  computeJob event  (async, invoked by POST /run)
    - For each of the 3 datasets: fits OLS + regularized, computes the four
      evaluation metrics and the combined score, and renders OLS-vs-reg brain
      surface images for every contrast.
    - Writes results + image keys to renders/{jobId}/status.json in S3.

  GET /status/{jobId}  (sync, API Gateway)
    - If ready: { ready: true, results: {...}, images: { <ds>: { <contrast>: url }}}
    - Else:     { ready: false }
"""

import io
import json
import os
import uuid

import boto3
import matplotlib
matplotlib.use('Agg')
import numpy as np
from scipy import sparse
from core_glm import (norm, fit_ols, fit_regularized, fit_mse, contrast_zscore,
                      _apply_cluster_threshold, _sig_mask, _map_corr, _dice,
                      _evaluate, compute_score)

BUCKET = os.environ["BUCKET_NAME"]
_s3     = boto3.client("s3")
_lambda = boto3.client("lambda")
_cache: dict = {}

DATASETS = ["localizer", "spm_auditory", "spm_multimodal"]
DATASET_LABELS = {
    "localizer":      "Localizer (Pinel)",
    "spm_auditory":   "SPM Auditory",
    "spm_multimodal": "SPM Multimodal",
}


# ---------------------------------------------------------------------------
# S3 helpers
# ---------------------------------------------------------------------------

def _s3_bytes(key: str) -> bytes:
    return _s3.get_object(Bucket=BUCKET, Key=key)["Body"].read()

def _load_npy(key: str) -> np.ndarray:
    if key not in _cache:
        _cache[key] = np.load(io.BytesIO(_s3_bytes(key)), allow_pickle=False)
    return _cache[key]

def _load_npz_sparse(key: str):
    if key not in _cache:
        _cache[key] = sparse.load_npz(io.BytesIO(_s3_bytes(key))).tocsr()
    return _cache[key]

def _load_npz_arrays(key: str):
    """Load a plain (non-sparse) .npz into a {name: array} dict, cached."""
    if key not in _cache:
        npz = np.load(io.BytesIO(_s3_bytes(key)), allow_pickle=False)
        _cache[key] = {k: npz[k] for k in npz.files}
    return _cache[key]


def _load_shared():
    """Eigenbasis + mesh + sulcal maps — shared across all datasets."""
    evals  = _load_npy("data/evals.npy")
    evecs  = _load_npy("data/evecs.npy")
    n_left = int(_load_npy("data/n_left.npy"))
    L      = _load_npz_sparse("data/L.npz")
    mesh   = {
        "left_coords":  _load_npy("data/inflated_left_coords.npy"),
        "left_faces":   _load_npy("data/inflated_left_faces.npy"),
        "right_coords": _load_npy("data/inflated_right_coords.npy"),
        "right_faces":  _load_npy("data/inflated_right_faces.npy"),
        "sulc_left":    _load_npy("data/sulc_left.npy"),
        "sulc_right":   _load_npy("data/sulc_right.npy"),
    }
    return evals, evecs, n_left, L, mesh


def _load_dataset(name: str):
    X = _load_npy(f"data_multi/{name}/X.npy")
    Y = _load_npy(f"data_multi/{name}/Y.npy")
    contrasts = _load_npz_arrays(f"data_multi/{name}/contrasts.npz")
    return X, Y, contrasts


# ---------------------------------------------------------------------------
# Core math
# ---------------------------------------------------------------------------

def _sig_counts(z, threshold, two_sided, cluster_size, L):
    pos = z > threshold
    neg = (z < -threshold) if two_sided else np.zeros(len(z), dtype=bool)
    if cluster_size > 1 and L is not None:
        pos = _apply_cluster_threshold(pos, L, cluster_size)
        neg = _apply_cluster_threshold(neg, L, cluster_size)
    return {"sig_positive": int(pos.sum()), "sig_negative": int(neg.sum()),
            "peak_z": float(np.nanmax(np.abs(z)))}


# ---------------------------------------------------------------------------
# Brain surface rendering (nilearn) — OLS vs Reg, both hemispheres
# ---------------------------------------------------------------------------

from collections import namedtuple as _namedtuple
_SurfMesh = _namedtuple('SurfMesh', ['coordinates', 'faces'])

def _make_mesh(coords, faces):
    return _SurfMesh(coordinates=coords.astype(np.float32), faces=faces.astype(np.int32))

def _render_panel(surf_mesh, z_vals, sulc, hemi, vmax, threshold, title):
    import matplotlib.pyplot as plt
    from nilearn.plotting import plot_surf_stat_map
    from PIL import Image as PILImage
    fig = plot_surf_stat_map(
        surf_mesh, np.nan_to_num(z_vals, nan=0.0), bg_map=sulc, hemi=hemi,
        view='lateral', cmap='cold_hot', vmax=vmax, threshold=threshold,
        colorbar=True, title=title, bg_on_data=True,
    )
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=90, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    img = PILImage.open(buf); img.load()
    return img

def _render_contrast_image(mesh, z_ols, z_reg, n_left, threshold, lam, cname) -> bytes:
    from PIL import Image as PILImage
    ml = _make_mesh(mesh["left_coords"],  mesh["left_faces"])
    mr = _make_mesh(mesh["right_coords"], mesh["right_faces"])
    sl, sr = mesh["sulc_left"], mesh["sulc_right"]
    zo_l, zo_r = z_ols[:n_left], z_ols[n_left:]
    zr_l, zr_r = z_reg[:n_left], z_reg[n_left:]
    vmax = float(min(max(np.nanmax(np.abs(z_ols)), np.nanmax(np.abs(z_reg))), 8.0))
    vmax = max(vmax, threshold + 0.5)

    # Always show both hemispheres for both methods (2x2): OLS L/R, Reg L/R
    panels = [
        _render_panel(ml, zo_l, sl, 'left',  vmax, threshold, 'OLS (L)'),
        _render_panel(mr, zo_r, sr, 'right', vmax, threshold, 'OLS (R)'),
        _render_panel(ml, zr_l, sl, 'left',  vmax, threshold, f'Reg λ={lam:g} (L)'),
        _render_panel(mr, zr_r, sr, 'right', vmax, threshold, f'Reg λ={lam:g} (R)'),
    ]
    w = max(p.width for p in panels); h = max(p.height for p in panels)
    combined = PILImage.new('RGB', (2 * w, 2 * h), (17, 24, 39))
    for i, p in enumerate(panels):
        cx = (i % 2) * w + (w - p.width) // 2
        cy = (i // 2) * h + (h - p.height) // 2
        combined.paste(p, (cx, cy))
    buf = io.BytesIO(); combined.save(buf, format='PNG'); buf.seek(0)
    return buf.read()


# ---------------------------------------------------------------------------
# Mode 1 — POST /run: mint jobId, kick off async job, return immediately
# ---------------------------------------------------------------------------

def _handle_run(body, context):
    job_id = str(uuid.uuid4())
    _lambda.invoke(
        FunctionName=context.function_name,
        InvocationType='Event',
        Payload=json.dumps({"computeJob": True, "jobId": job_id, "params": body}).encode(),
    )
    return _resp(200, {"jobId": job_id, "ready": False})


# ---------------------------------------------------------------------------
# Mode 2 — async compute + render job
# ---------------------------------------------------------------------------

def _safe(s):
    return s.replace(' ', '_').replace('/', '-').replace('(', '').replace(')', '')

def _handle_job(event):
    body = event["params"]
    job_id = event["jobId"]
    lam         = float(body.get("lambda", 2.66))
    k_requested = int(body.get("n_eigenvectors", 1000))
    p_val       = float(body.get("p_val", 6.45e-5))
    cluster     = int(body.get("cluster_threshold", 19))
    two_sided   = bool(body.get("two_sided", True))

    evals_full, evecs_full, n_left, L, mesh = _load_shared()
    k     = min(k_requested, evals_full.shape[0])
    evals = evals_full[:k]
    evecs = evecs_full[:, :k]
    threshold = float(norm.isf(p_val))

    datasets_out = {}
    image_keys   = {}
    scores = []
    for name in DATASETS:
        X, Y, contrasts = _load_dataset(name)
        B_ols = fit_ols(X, Y)
        B_reg = fit_regularized(X, Y, evals, evecs, lam, B_ols)
        ev = _evaluate(X, Y, evals, evecs, lam, B_ols, B_reg, contrasts,
                       threshold, two_sided, cluster, L)
        score, dims = compute_score(ev)
        scores.append(score)

        contrast_stats = {}
        image_keys[name] = {}
        for cname, c in contrasts.items():
            z_ols = contrast_zscore(X, Y, B_ols, c)
            z_reg = contrast_zscore(X, Y, B_reg, c)
            contrast_stats[cname] = {
                "ols": _sig_counts(z_ols, threshold, two_sided, cluster, L),
                "reg": _sig_counts(z_reg, threshold, two_sided, cluster, L),
            }
            png = _render_contrast_image(mesh, z_ols, z_reg, n_left, threshold, lam, cname)
            key = f"renders/{job_id}/{name}__{_safe(cname)}.png"
            _s3.put_object(Bucket=BUCKET, Key=key, Body=png, ContentType='image/png')
            image_keys[name][cname] = key

        datasets_out[name] = {
            "label":     DATASET_LABELS[name],
            "score":     score,
            "dims":      dims,
            "contrasts": contrast_stats,
        }

    combined = float(np.mean(scores))
    results = {
        "combined":  combined,
        "datasets":  datasets_out,
        "selected":  {"lambda": lam, "n_eigenvectors": k,
                      "p_val": p_val, "cluster_threshold": cluster},
    }
    _s3.put_object(
        Bucket=BUCKET, Key=f"renders/{job_id}/status.json",
        Body=json.dumps({"ready": True, "results": results, "imageKeys": image_keys}).encode(),
        ContentType="application/json",
    )


# ---------------------------------------------------------------------------
# Mode 3 — GET /status/{jobId}
# ---------------------------------------------------------------------------

def _handle_status(job_id):
    try:
        obj = _s3.get_object(Bucket=BUCKET, Key=f"renders/{job_id}/status.json")
        status = json.loads(obj["Body"].read())
    except Exception:
        return _resp(200, {"ready": False})

    images = {}
    for ds, contrasts in status.get("imageKeys", {}).items():
        images[ds] = {}
        for cname, key in contrasts.items():
            images[ds][cname] = _s3.generate_presigned_url(
                "get_object", Params={"Bucket": BUCKET, "Key": key}, ExpiresIn=3600)

    return _resp(200, {"ready": True, "results": status["results"], "images": images})


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

def _resp(code, obj):
    return {
        "statusCode": code,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(obj),
    }

def lambda_handler(event, context):
    try:
        if event.get("computeJob"):
            _handle_job(event)
            return
        raw_path = event.get("rawPath", "")
        if raw_path.startswith("/status/"):
            return _handle_status(raw_path.split("/status/", 1)[1].strip("/"))
        body = json.loads(event.get("body") or "{}")
        return _handle_run(body, context)
    except Exception as exc:
        import traceback
        return _resp(500, {"error": str(exc), "trace": traceback.format_exc()})
