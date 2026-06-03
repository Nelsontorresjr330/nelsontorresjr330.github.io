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
    return X, Y, evals, evecs, n_left, L, mesh, contrasts


# ---------------------------------------------------------------------------
# Core math — identical to LaplacianPenalty.py
# ---------------------------------------------------------------------------

def fit_ols(X, Y):
    return np.linalg.lstsq(X, Y, rcond=None)[0]

def fit_regularized(X, Y, evals, evecs, lam, B_ols):
    XtX      = X.T @ X
    R        = (X.T @ Y) @ evecs
    sigma, U = np.linalg.eigh(XtX)
    sigma    = np.maximum(sigma, 1e-12)
    UtR      = U.T @ R
    C_ols    = U @ (UtR / sigma[:, None])                          # OLS in k-mode subspace
    C_reg    = U @ (UtR / (sigma[:, None] + lam * evals[None, :])) # regularized in k-mode subspace
    # Correct only the k smooth modes; modes outside eigenbasis stay at OLS values
    return B_ols + (C_reg - C_ols) @ evecs.T

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
# Evaluation helpers
# ---------------------------------------------------------------------------

def _dice(mask1: np.ndarray, mask2: np.ndarray) -> float:
    n = int(np.sum(mask1) + np.sum(mask2))
    return 2 * int(np.sum(mask1 & mask2)) / n if n > 0 else 1.0

def _map_corr(z1: np.ndarray, z2: np.ndarray) -> float:
    m = np.isfinite(z1) & np.isfinite(z2)
    return float(np.corrcoef(z1[m], z2[m])[0, 1]) if m.sum() > 1 else 0.0

def _sig_mask(z: np.ndarray, threshold: float, two_sided: bool) -> np.ndarray:
    return (np.abs(z) > threshold) if two_sided else (z > threshold)

def _evaluate(X, Y, evals, evecs, lam, B_ols, B_reg, contrasts, threshold, two_sided):
    T   = X.shape[0]
    odd = np.arange(0, T, 2)
    eve = np.arange(1, T, 2)

    # ── 1. Held-out MSE — fit on first 80 % of timepoints, test on last 20 % ──
    sp       = int(T * 0.8)
    B_ols_tr = fit_ols(X[:sp], Y[:sp])
    B_reg_tr = fit_regularized(X[:sp], Y[:sp], evals, evecs, lam, B_ols_tr)
    held_out_mse = {
        "ols": fit_mse(X[sp:], Y[sp:], B_ols_tr),
        "reg": fit_mse(X[sp:], Y[sp:], B_reg_tr),
    }

    # ── 2. Semi-synthetic recovery — OLS betas as ground truth ───────────────
    # Y_synth = X @ B_ols + noise matched to actual residual variance.
    # Both methods are judged on how well they recover the OLS contrast maps.
    # Fixed seed ensures the test is identical across API calls.
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
        semi_synthetic[name] = {
            "recovery_corr_ols": _map_corr(z_true, z_ols_sy),
            "recovery_corr_reg": _map_corr(z_true, z_reg_sy),
        }

    # ── 3. Split-half reproducibility — odd vs even timepoints ───────────────
    # Interleaved split preserves temporal coverage and HRF sampling in each half.
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
            "dice_ols":     _dice(_sig_mask(zo_o, threshold, two_sided),
                                  _sig_mask(zo_e, threshold, two_sided)),
            "dice_reg":     _dice(_sig_mask(zr_o, threshold, two_sided),
                                  _sig_mask(zr_e, threshold, two_sided)),
        }

    # ── 4. HRF consistency — GLM R² at each method's significant vertices ─────
    # Uses OLS R² as a neutral reference: measures how much of the BOLD variance
    # at each vertex is explained by the design matrix.
    # High R² at a significant vertex → the vertex genuinely tracks the task.
    # Low R² → the vertex was flagged on noise.
    SS_res = np.sum((Y - X @ B_ols) ** 2, axis=0)
    SS_tot = np.sum((Y - Y.mean(axis=0, keepdims=True)) ** 2, axis=0)
    r2     = np.clip(1.0 - SS_res / (SS_tot + 1e-12), 0.0, 1.0)

    hrf_consistency = {}
    for name, c in contrasts.items():
        z_o = contrast_zscore(X, Y, B_ols, c)
        z_r = contrast_zscore(X, Y, B_reg, c)
        sig_o = _sig_mask(z_o, threshold, two_sided)
        sig_r = _sig_mask(z_r, threshold, two_sided)
        def _mr2(mask):
            return float(np.mean(r2[mask])) if mask.any() else None
        hrf_consistency[name] = {
            "r2_ols_sig":  _mr2(sig_o),           # R² averaged over OLS-significant vertices
            "r2_reg_sig":  _mr2(sig_r),            # R² averaged over reg-significant vertices
            "r2_ols_only": _mr2(sig_o & ~sig_r),  # vertices reg dropped — were they task-driven?
            "r2_reg_only": _mr2(sig_r & ~sig_o),  # vertices reg added  — are they task-driven?
        }

    return {
        "held_out_mse":    held_out_mse,
        "semi_synthetic":  semi_synthetic,
        "reproducibility": reproducibility,
        "hrf_consistency": hrf_consistency,
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

    X, Y, evals_full, evecs_full, n_left, L, mesh, contrasts = _load_all()
    k     = min(k_requested, evals_full.shape[0])
    evals = evals_full[:k]
    evecs = evecs_full[:, :k]
    threshold = float(norm.isf(p_val))

    B_ols = fit_ols(X, Y)

    # Pre-compute split-half OLS fits once — reused in both sweep and _evaluate
    T    = X.shape[0]
    odd  = np.arange(0, T, 2)
    eve  = np.arange(1, T, 2)
    B_ols_odd = fit_ols(X[odd], Y[odd])
    B_ols_eve = fit_ols(X[eve], Y[eve])

    sweep_mse, sweep_rough, sweep_repro = [], [], []
    for lv in lambda_sweep:
        B    = B_ols if lv == 0.0 else fit_regularized(X, Y, evals, evecs, lv, B_ols)
        Bro  = B_ols_odd if lv == 0.0 else fit_regularized(X[odd], Y[odd], evals, evecs, lv, B_ols_odd)
        Bre  = B_ols_eve if lv == 0.0 else fit_regularized(X[eve], Y[eve], evals, evecs, lv, B_ols_eve)
        sweep_mse.append(fit_mse(X, Y, B))
        sweep_rough.append(roughness(B, L))
        sweep_repro.append(float(np.mean([
            _map_corr(contrast_zscore(X[odd], Y[odd], Bro, c),
                      contrast_zscore(X[eve], Y[eve], Bre, c))
            for c in contrasts.values()
        ])))

    B_reg = fit_regularized(X, Y, evals, evecs, lam, B_ols)

    contrast_results = {}
    for name, c in contrasts.items():
        z_ols = contrast_zscore(X, Y, B_ols, c)
        z_reg = contrast_zscore(X, Y, B_reg, c)
        contrast_results[name] = {
            "ols": _zscore_summary(z_ols, threshold, two_sided),
            "reg": _zscore_summary(z_reg, threshold, two_sided),
        }

    evaluation = _evaluate(X, Y, evals, evecs, lam, B_ols, B_reg, contrasts, threshold, two_sided)

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
            "sweep": {
                "lambdas":        lambda_sweep,
                "mse":            sweep_mse,
                "roughness":      sweep_rough,
                "reproducibility": sweep_repro,
            },
            "selected": {
                "lambda":         lam,
                "n_eigenvectors": k,
                "mse_ols":        fit_mse(X, Y, B_ols),
                "mse_reg":        fit_mse(X, Y, B_reg),
                "roughness_ols":  roughness(B_ols, L),
                "roughness_reg":  roughness(B_reg, L),
            },
            "contrasts":   contrast_results,
            "evaluation":  evaluation,
            "jobId":       job_id,
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

    X, Y, evals_full, evecs_full, n_left, L, mesh, contrasts = _load_all()
    k_requested = int(body.get("n_eigenvectors", 500))
    k     = min(k_requested, evals_full.shape[0])
    evals = evals_full[:k]
    evecs = evecs_full[:, :k]

    B_ols = fit_ols(X, Y)
    B_reg = fit_regularized(X, Y, evals, evecs, lam, B_ols)

    image_keys = {}
    for name, c in contrasts.items():
        z_ols  = contrast_zscore(X, Y, B_ols, c)
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
