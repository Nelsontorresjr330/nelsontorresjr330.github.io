"""
Lambda handler — Laplacian-regularized GLM simulation.

Three execution modes dispatched from lambda_handler:

  POST /run  (sync, API Gateway)
    - Loads cached data from S3, runs all math
    - Returns sweep + stats + jobId immediately (<15 s, fits in 29 s API Gateway limit)
    - Invokes itself asynchronously to render brain images in the background

  renderJob event  (async, invoked by the POST /run handler)
    - Generates matplotlib brain surface images
    - Stores PNGs + a status.json in S3 under renders/{jobId}/
    - No response required (async invocation)

  GET /status/{jobId}  (sync, API Gateway)
    - Checks S3 for renders/{jobId}/status.json
    - If ready: returns { ready: true, images: { <contrast>: <presigned_url> } }
    - If not yet: returns { ready: false }
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
from scipy.stats import norm

BUCKET = os.environ["BUCKET_NAME"]
_s3     = boto3.client("s3")
_lambda = boto3.client("lambda")
_cache: dict = {}


# ---------------------------------------------------------------------------
# S3 helpers
# ---------------------------------------------------------------------------

def _s3_bytes(key: str) -> bytes:
    return _s3.get_object(Bucket=BUCKET, Key=key)["Body"].read()

def _load_npy(key: str) -> np.ndarray:
    if key not in _cache:
        _cache[key] = np.load(io.BytesIO(_s3_bytes(key)), allow_pickle=False)
    return _cache[key]

def _load_npz(key: str):
    if key not in _cache:
        _cache[key] = sparse.load_npz(io.BytesIO(_s3_bytes(key))).tocsr()
    return _cache[key]

def _load_all():
    X      = _load_npy("data/X.npy")
    Y      = _load_npy("data/Y.npy")
    evals  = _load_npy("data/evals.npy")
    evecs  = _load_npy("data/evecs.npy")
    n_left = int(_load_npy("data/n_left.npy"))
    L      = _load_npz("data/L.npz")
    mesh   = {
        "left_coords":  _load_npy("data/inflated_left_coords.npy"),
        "left_faces":   _load_npy("data/inflated_left_faces.npy"),
        "right_coords": _load_npy("data/inflated_right_coords.npy"),
        "right_faces":  _load_npy("data/inflated_right_faces.npy"),
        "sulc_left":    _load_npy("data/sulc_left.npy"),
        "sulc_right":   _load_npy("data/sulc_right.npy"),
    }
    contrasts = {
        "(left - right) button press": _load_npy("data/contrast_left_minus_right.npy"),
        "audio - visual":              _load_npy("data/contrast_audio_minus_visual.npy"),
        "computation - sentences":     _load_npy("data/contrast_computation_minus_sentences.npy"),
    }
    # Precomputed nilearn AR-corrected OLS z-maps (exact match to LaplacianPenalty.py)
    ols_zmaps = {
        "(left - right) button press": _load_npy("data/ols_z_left_minus_right_button_press.npy"),
        "audio - visual":              _load_npy("data/ols_z_audio_minus_visual.npy"),
        "computation - sentences":     _load_npy("data/ols_z_computation_minus_sentences.npy"),
    }
    return X, Y, evals, evecs, n_left, L, mesh, contrasts, ols_zmaps


# ---------------------------------------------------------------------------
# Core math — identical to LaplacianPenalty.py
# ---------------------------------------------------------------------------

def fit_ols(X, Y):
    return np.linalg.lstsq(X, Y, rcond=None)[0]

def fit_regularized(X, Y, evals, evecs, lam):
    XtX      = X.T @ X
    R        = (X.T @ Y) @ evecs
    sigma, U = np.linalg.eigh(XtX)
    sigma    = np.maximum(sigma, 1e-12)
    denom    = sigma[:, None] + lam * evals[None, :]
    C        = U @ ((U.T @ R) / denom)
    return C @ evecs.T

def fit_mse(X, Y, B) -> float:
    return float(np.mean((Y - X @ B) ** 2))

def roughness(B, L) -> float:
    LBt = np.asarray(L @ B.T)
    return float(np.trace(B @ LBt) / B.shape[1])

def contrast_zscore(X, Y, B, c) -> np.ndarray:
    T, p     = X.shape
    resid    = Y - X @ B
    sigma2   = np.sum(resid ** 2, axis=0) / (T - p)
    se_scale = float(c @ np.linalg.inv(X.T @ X) @ c)
    return (c @ B) / np.sqrt(sigma2 * se_scale + 1e-12)

def _zscore_summary(z, threshold, two_sided):
    zf = z[np.isfinite(z)]
    hist, edges = np.histogram(zf, bins=60, range=(-8.0, 8.0))
    return {
        "sig_positive": int(np.sum(zf >  threshold)),
        "sig_negative": int(np.sum(zf < -threshold)) if two_sided else 0,
        "peak_z":       float(np.nanmax(np.abs(z))),
        "mean_z":       float(np.nanmean(z)),
        "threshold":    float(threshold),
        "histogram": {"counts": hist.tolist(), "edges": np.round(edges, 3).tolist()},
    }


# ---------------------------------------------------------------------------
# Brain surface image rendering — uses nilearn for 1:1 match with local script
# ---------------------------------------------------------------------------

from collections import namedtuple as _namedtuple
_SurfMesh = _namedtuple('SurfMesh', ['coordinates', 'faces'])

def _make_mesh(coords: np.ndarray, faces: np.ndarray) -> _SurfMesh:
    return _SurfMesh(coordinates=coords.astype(np.float32), faces=faces.astype(np.int32))


def _render_panel(surf_mesh, z_vals, sulc, hemi, vmax, threshold, title):
    import matplotlib.pyplot as plt
    from nilearn.plotting import plot_surf_stat_map
    from PIL import Image as PILImage
    fig = plot_surf_stat_map(
        surf_mesh,
        np.nan_to_num(z_vals, nan=0.0),
        bg_map=sulc,
        hemi=hemi,
        view='lateral',
        cmap='cold_hot',
        vmax=vmax,
        threshold=threshold,
        colorbar=True,
        title=title,
        bg_on_data=True,
    )
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    from PIL import Image as PILImage
    img = PILImage.open(buf)
    img.load()
    return img


def _render_contrast_image(mesh, z_ols, z_reg, n_left, threshold, lam, cname) -> bytes:
    gifti_l = _make_mesh(mesh["left_coords"],  mesh["left_faces"])
    gifti_r = _make_mesh(mesh["right_coords"], mesh["right_faces"])
    sulc_l  = mesh["sulc_left"]
    sulc_r  = mesh["sulc_right"]

    z_ols_l, z_ols_r = z_ols[:n_left], z_ols[n_left:]
    z_reg_l, z_reg_r = z_reg[:n_left], z_reg[n_left:]

    vmax = float(min(max(np.nanmax(np.abs(z_ols)), np.nanmax(np.abs(z_reg))), 8.0))
    vmax = max(vmax, threshold + 0.5)

    both_hemi = "(left - right)" in cname

    panels = []
    if both_hemi:
        panels.append(_render_panel(gifti_l, z_ols_l, sulc_l, 'left',  vmax, threshold, 'OLS (left)'))
        panels.append(_render_panel(gifti_r, z_ols_r, sulc_r, 'right', vmax, threshold, 'OLS (right)'))
        panels.append(_render_panel(gifti_l, z_reg_l, sulc_l, 'left',  vmax, threshold, f'Reg λ={lam} (left)'))
        panels.append(_render_panel(gifti_r, z_reg_r, sulc_r, 'right', vmax, threshold, f'Reg λ={lam} (right)'))
    else:
        panels.append(_render_panel(gifti_l, z_ols_l, sulc_l, 'left', vmax, threshold, 'OLS'))
        panels.append(_render_panel(gifti_l, z_reg_l, sulc_l, 'left', vmax, threshold, f'Reg λ={lam}'))

    # Stitch panels horizontally into one image
    from PIL import Image as PILImage
    total_w = sum(p.width for p in panels)
    max_h   = max(p.height for p in panels)
    combined = PILImage.new('RGB', (total_w, max_h), (17, 24, 39))
    x = 0
    for p in panels:
        combined.paste(p, (x, (max_h - p.height) // 2))
        x += p.width

    buf = io.BytesIO()
    combined.save(buf, format='PNG')
    buf.seek(0)
    return buf.read()


# ---------------------------------------------------------------------------
# Execution mode 1 — POST /run  (sync, returns stats + jobId)
# ---------------------------------------------------------------------------

def _handle_compute(body, context):
    lam               = float(body.get("lambda", 0.1))
    lambda_sweep      = [float(v) for v in body.get("lambda_sweep",
                         [0.0, 0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0])]
    k_requested       = int(body.get("n_eigenvectors", 500))
    p_val             = float(body.get("p_val", 0.001))
    cluster_threshold = int(body.get("cluster_threshold", 20))
    two_sided         = bool(body.get("two_sided", True))

    X, Y, evals_full, evecs_full, n_left, L, mesh, contrasts, ols_zmaps = _load_all()
    k     = min(k_requested, evals_full.shape[0])
    evals = evals_full[:k]
    evecs = evecs_full[:, :k]
    threshold = float(norm.isf(p_val))

    sweep_mse, sweep_rough = [], []
    for lv in lambda_sweep:
        B = fit_ols(X, Y) if lv == 0.0 else fit_regularized(X, Y, evals, evecs, lv)
        sweep_mse.append(fit_mse(X, Y, B))
        sweep_rough.append(roughness(B, L))

    B_ols = fit_ols(X, Y)
    B_reg = fit_regularized(X, Y, evals, evecs, lam)

    contrast_results = {}
    for name, c in contrasts.items():
        z_ols = ols_zmaps[name]
        z_reg = contrast_zscore(X, Y, B_reg, c)
        contrast_results[name] = {
            "ols": _zscore_summary(z_ols, threshold, two_sided),
            "reg": _zscore_summary(z_reg, threshold, two_sided),
        }

    # Kick off async render job
    job_id = str(uuid.uuid4())
    _lambda.invoke(
        FunctionName=context.function_name,
        InvocationType='Event',  # async — does not wait
        Payload=json.dumps({
            "renderJob": True,
            "jobId":     job_id,
            "params":    body,
        }).encode(),
    )

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps({
            "sweep": {"lambdas": lambda_sweep, "mse": sweep_mse, "roughness": sweep_rough},
            "selected": {
                "lambda":         lam,
                "n_eigenvectors": k,
                "mse_ols":        fit_mse(X, Y, B_ols),
                "mse_reg":        fit_mse(X, Y, B_reg),
                "roughness_ols":  roughness(B_ols, L),
                "roughness_reg":  roughness(B_reg, L),
            },
            "contrasts": contrast_results,
            "jobId":     job_id,
            "imagesReady": False,
        }),
    }


# ---------------------------------------------------------------------------
# Execution mode 2 — async render job  (no API Gateway, invoked by mode 1)
# ---------------------------------------------------------------------------

def _handle_render_job(event):
    job_id = event["jobId"]
    body   = event["params"]

    lam       = float(body.get("lambda", 0.1))
    p_val     = float(body.get("p_val", 0.001))
    two_sided = bool(body.get("two_sided", True))
    threshold = float(norm.isf(p_val))

    X, Y, evals_full, evecs_full, n_left, L, mesh, contrasts, ols_zmaps = _load_all()
    k_requested = int(body.get("n_eigenvectors", 500))
    k     = min(k_requested, evals_full.shape[0])
    evals = evals_full[:k]
    evecs = evecs_full[:, :k]

    B_reg = fit_regularized(X, Y, evals, evecs, lam)

    image_keys = {}
    for name, c in contrasts.items():
        z_ols  = ols_zmaps[name]
        z_reg  = contrast_zscore(X, Y, B_reg, c)
        png    = _render_contrast_image(mesh, z_ols, z_reg, n_left, threshold, lam, name)
        s3_key = f"renders/{job_id}/{name.replace(' ', '_').replace('/', '-')}.png"
        _s3.put_object(Bucket=BUCKET, Key=s3_key, Body=png, ContentType='image/png')
        image_keys[name] = s3_key

    _s3.put_object(
        Bucket=BUCKET,
        Key=f"renders/{job_id}/status.json",
        Body=json.dumps({"ready": True, "imageKeys": image_keys}).encode(),
        ContentType="application/json",
    )


# ---------------------------------------------------------------------------
# Execution mode 3 — GET /status/{jobId}  (sync, API Gateway)
# ---------------------------------------------------------------------------

def _handle_status(job_id):
    try:
        obj    = _s3.get_object(Bucket=BUCKET, Key=f"renders/{job_id}/status.json")
        status = json.loads(obj["Body"].read())
    except _s3.exceptions.NoSuchKey:
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"ready": False}),
        }
    except Exception:
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"ready": False}),
        }

    # Generate pre-signed URLs (valid 1 hour)
    images = {}
    for name, key in status["imageKeys"].items():
        images[name] = _s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": key},
            ExpiresIn=3600,
        )

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"ready": True, "images": images}),
    }


# ---------------------------------------------------------------------------
# Entry point — dispatch to correct mode
# ---------------------------------------------------------------------------

def lambda_handler(event, context):
    try:
        # Mode 2: async render job (no routeKey, has renderJob flag)
        if event.get("renderJob"):
            _handle_render_job(event)
            return

        # Mode 3: status check
        raw_path = event.get("rawPath", "")
        if raw_path.startswith("/status/"):
            job_id = raw_path.split("/status/", 1)[1].strip("/")
            return _handle_status(job_id)

        # Mode 1: sync compute (POST /run)
        body = json.loads(event.get("body") or "{}")
        return _handle_compute(body, context)

    except Exception as exc:
        import traceback
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(exc), "trace": traceback.format_exc()}),
        }
