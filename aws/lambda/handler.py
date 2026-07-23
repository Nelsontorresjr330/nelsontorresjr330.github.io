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
from scipy.sparse.csgraph import connected_components as _sparse_cc
from scipy.stats import norm

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

def fit_ols(X, Y):
    return np.linalg.lstsq(X, Y, rcond=None)[0]

def fit_regularized(X, Y, evals, evecs, lam, B_ols):
    XtX      = X.T @ X
    R        = (X.T @ Y) @ evecs
    sigma, U = np.linalg.eigh(XtX)
    sigma    = np.maximum(sigma, 1e-12)
    UtR      = U.T @ R
    C_ols    = U @ (UtR / sigma[:, None])
    C_reg    = U @ (UtR / (sigma[:, None] + lam * evals[None, :]))
    return B_ols + (C_reg - C_ols) @ evecs.T

def fit_mse(X, Y, B) -> float:
    return float(np.mean((Y - X @ B) ** 2))

def contrast_zscore(X, Y, B, c) -> np.ndarray:
    T, p     = X.shape
    resid    = Y - X @ B
    sigma2   = np.sum(resid ** 2, axis=0) / (T - p)
    se_scale = float(c @ np.linalg.inv(X.T @ X) @ c)
    return (c @ B) / np.sqrt(sigma2 * se_scale + 1e-12)

def _apply_cluster_threshold(mask, L, min_size):
    if min_size <= 1 or not mask.any():
        return mask
    idx = np.where(mask)[0]
    L_sub = L[idx, :][:, idx]
    _, labels = _sparse_cc(L_sub, directed=False, connection='weak')
    out = np.zeros(len(mask), dtype=bool)
    for lbl in range(labels.max() + 1):
        comp = idx[labels == lbl]
        if len(comp) >= min_size:
            out[comp] = True
    return out

def _sig_mask(z, threshold, two_sided, cluster_size=1, L=None):
    pos = z > threshold
    neg = (z < -threshold) if two_sided else np.zeros(len(z), dtype=bool)
    if cluster_size > 1 and L is not None:
        pos = _apply_cluster_threshold(pos, L, cluster_size)
        neg = _apply_cluster_threshold(neg, L, cluster_size)
    return pos | neg

def _dice(m1, m2):
    n = int(np.sum(m1) + np.sum(m2))
    return 2 * int(np.sum(m1 & m2)) / n if n > 0 else 1.0

def _map_corr(z1, z2):
    m = np.isfinite(z1) & np.isfinite(z2)
    return float(np.corrcoef(z1[m], z2[m])[0, 1]) if m.sum() > 1 else 0.0

def _sig_counts(z, threshold, two_sided, cluster_size, L):
    pos = z > threshold
    neg = (z < -threshold) if two_sided else np.zeros(len(z), dtype=bool)
    if cluster_size > 1 and L is not None:
        pos = _apply_cluster_threshold(pos, L, cluster_size)
        neg = _apply_cluster_threshold(neg, L, cluster_size)
    return {"sig_positive": int(pos.sum()), "sig_negative": int(neg.sum()),
            "peak_z": float(np.nanmax(np.abs(z)))}


# ---------------------------------------------------------------------------
# Evaluation + combined score (identical definition to param_search_multi)
# ---------------------------------------------------------------------------

def _evaluate(X, Y, evals, evecs, lam, B_ols, B_reg, contrasts, threshold, two_sided,
              cluster_size, L):
    T   = X.shape[0]
    odd = np.arange(0, T, 2)
    eve = np.arange(1, T, 2)

    sp       = int(T * 0.8)
    B_ols_tr = fit_ols(X[:sp], Y[:sp])
    B_reg_tr = fit_regularized(X[:sp], Y[:sp], evals, evecs, lam, B_ols_tr)
    held_out_mse = {"ols": fit_mse(X[sp:], Y[sp:], B_ols_tr),
                    "reg": fit_mse(X[sp:], Y[sp:], B_reg_tr)}

    rng      = np.random.default_rng(42)
    res_std  = float(np.std(Y - X @ B_ols))
    Y_syn    = X @ B_ols + rng.normal(0.0, res_std, Y.shape)
    B_ols_sy = fit_ols(X, Y_syn)
    B_reg_sy = fit_regularized(X, Y_syn, evals, evecs, lam, B_ols_sy)
    semi_synthetic = {}
    for name, c in contrasts.items():
        z_true   = contrast_zscore(X, Y,     B_ols,    c)
        z_ols_sy = contrast_zscore(X, Y_syn, B_ols_sy, c)
        z_reg_sy = contrast_zscore(X, Y_syn, B_reg_sy, c)
        semi_synthetic[name] = {"recovery_corr_ols": _map_corr(z_true, z_ols_sy),
                                "recovery_corr_reg": _map_corr(z_true, z_reg_sy)}

    B_ols_odd = fit_ols(X[odd], Y[odd])
    B_ols_eve = fit_ols(X[eve], Y[eve])
    B_reg_odd = fit_regularized(X[odd], Y[odd], evals, evecs, lam, B_ols_odd)
    B_reg_eve = fit_regularized(X[eve], Y[eve], evals, evecs, lam, B_ols_eve)
    reproducibility = {}
    for name, c in contrasts.items():
        zo_o = contrast_zscore(X[odd], Y[odd], B_ols_odd, c)
        zo_e = contrast_zscore(X[eve], Y[eve], B_ols_eve, c)
        zr_o = contrast_zscore(X[odd], Y[odd], B_reg_odd, c)
        zr_e = contrast_zscore(X[eve], Y[eve], B_reg_eve, c)
        reproducibility[name] = {
            "map_corr_ols": _map_corr(zo_o, zo_e),
            "map_corr_reg": _map_corr(zr_o, zr_e),
            "dice_ols": _dice(_sig_mask(zo_o, threshold, two_sided, cluster_size, L),
                              _sig_mask(zo_e, threshold, two_sided, cluster_size, L)),
            "dice_reg": _dice(_sig_mask(zr_o, threshold, two_sided, cluster_size, L),
                              _sig_mask(zr_e, threshold, two_sided, cluster_size, L)),
        }

    SS_res = np.sum((Y - X @ B_ols) ** 2, axis=0)
    SS_tot = np.sum((Y - Y.mean(axis=0, keepdims=True)) ** 2, axis=0)
    r2     = np.clip(1.0 - SS_res / (SS_tot + 1e-12), 0.0, 1.0)
    hrf_consistency = {}
    for name, c in contrasts.items():
        z_o = contrast_zscore(X, Y, B_ols, c)
        z_r = contrast_zscore(X, Y, B_reg, c)
        sig_o = _sig_mask(z_o, threshold, two_sided, cluster_size, L)
        sig_r = _sig_mask(z_r, threshold, two_sided, cluster_size, L)
        _mr2 = lambda m: (float(np.mean(r2[m])) if m.any() else None)
        hrf_consistency[name] = {"r2_ols_sig": _mr2(sig_o), "r2_reg_sig": _mr2(sig_r)}

    return {"held_out_mse": held_out_mse, "semi_synthetic": semi_synthetic,
            "reproducibility": reproducibility, "hrf_consistency": hrf_consistency}


def compute_score(ev):
    eps  = 1e-9
    dims = {}
    mo, mr = ev["held_out_mse"]["ols"], ev["held_out_mse"]["reg"]
    dims["generalization"] = (mo - mr) / (mo + eps)
    ss = list(ev["semi_synthetic"].values())
    dims["recovery"] = sum((v["recovery_corr_reg"] - v["recovery_corr_ols"]) /
                           (abs(v["recovery_corr_ols"]) + eps) for v in ss) / len(ss)
    rp = list(ev["reproducibility"].values())
    dims["reproducibility"] = sum((v["map_corr_reg"] - v["map_corr_ols"]) /
                                  (abs(v["map_corr_ols"]) + eps) for v in rp) / len(rp)
    hrf_vals = []
    for v in ev["hrf_consistency"].values():
        ro, rr = v["r2_ols_sig"], v["r2_reg_sig"]
        if ro is not None and rr is not None:
            hrf_vals.append((rr - ro) / (abs(ro) + eps))
        elif ro is not None and rr is None:
            hrf_vals.append(-1.0)
        else:
            hrf_vals.append(0.0)
    dims["hrf_consistency"] = sum(hrf_vals) / len(hrf_vals) if hrf_vals else 0.0
    overall = sum(dims.values()) / len(dims)
    return overall, dims


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
