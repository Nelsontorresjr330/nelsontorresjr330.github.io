"""
Lambda handler for the Laplacian-regularized GLM simulation.

Cold start: downloads X, Y, evals, evecs, L, mesh, and contrast vectors from S3
into the module-level cache for subsequent warm invocations.

POST /run  body (all fields optional — defaults match LaplacianPenalty.py):
{
  "lambda":            0.1,
  "lambda_sweep":      [0.0, 0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0],
  "n_eigenvectors":    500,
  "p_val":             0.001,
  "cluster_threshold": 20,
  "two_sided":         true
}

Response adds an "images" key with base64-encoded PNG brain surface plots
(left hemisphere, lateral view) for each contrast, comparing OLS vs regularized.
"""

import base64
import io
import json
import os

import boto3
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from scipy import sparse
from scipy.stats import norm

BUCKET = os.environ["BUCKET_NAME"]
_s3 = boto3.client("s3")
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
    mesh = {
        "left_coords": _load_npy("data/inflated_left_coords.npy"),
        "left_faces":  _load_npy("data/inflated_left_faces.npy"),
        "right_coords": _load_npy("data/inflated_right_coords.npy"),
        "right_faces":  _load_npy("data/inflated_right_faces.npy"),
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


def fit_regularized(X, Y, evals, evecs, lam):
    XtX      = X.T @ X
    R        = (X.T @ Y) @ evecs
    sigma, U = np.linalg.eigh(XtX)
    sigma    = np.maximum(sigma, 1e-12)
    UtR      = U.T @ R
    denom    = sigma[:, None] + lam * evals[None, :]
    C        = U @ (UtR / denom)
    return C @ evecs.T


def fit_mse(X, Y, B) -> float:
    return float(np.mean((Y - X @ B) ** 2))


def roughness(B, L) -> float:
    LBt  = np.asarray(L @ B.T)
    BLBt = B @ LBt
    return float(np.trace(BLBt) / B.shape[1])


def contrast_zscore(X, Y, B, c) -> np.ndarray:
    T, p     = X.shape
    effect   = c @ B
    resid    = Y - X @ B
    sigma2   = np.sum(resid ** 2, axis=0) / (T - p)
    XtX_inv  = np.linalg.inv(X.T @ X)
    se_scale = float(c @ XtX_inv @ c)
    return effect / np.sqrt(sigma2 * se_scale + 1e-12)


# ---------------------------------------------------------------------------
# Brain surface image rendering
# ---------------------------------------------------------------------------

def _render_contrast_image(mesh, z_ols, z_reg, n_left, threshold, lam, cname):
    """
    Render a side-by-side brain surface comparison: OLS (left) vs Regularized (right).
    Shows left hemisphere lateral view, colored by z-score.
    Returns a base64-encoded PNG string.
    """
    coords_l = mesh["left_coords"].astype(np.float64)
    faces_l  = mesh["left_faces"]

    z_ols_l = z_ols[:n_left]
    z_reg_l = z_reg[:n_left]

    vmax = float(min(max(np.abs(z_ols_l).max(), np.abs(z_reg_l).max()), 8.0))
    vmax = max(vmax, threshold + 0.5)

    fig = plt.figure(figsize=(13, 5), facecolor='#111827')

    for col, (z_l, title) in enumerate([
        (z_ols_l, 'OLS'),
        (z_reg_l, f'Regularized  λ={lam}'),
    ]):
        ax = fig.add_subplot(1, 2, col + 1, projection='3d')
        ax.set_facecolor('#1f2937')

        # Per-face color: mean of the 3 vertex z-scores per triangle
        face_vals = z_l[faces_l].mean(axis=1)

        surf = ax.plot_trisurf(
            coords_l[:, 0], coords_l[:, 1], coords_l[:, 2],
            triangles=faces_l,
            cmap='RdBu_r',
            shade=False,
            linewidth=0,
        )
        surf.set_array(face_vals)
        surf.set_clim(-vmax, vmax)

        # Left hemisphere lateral view
        ax.view_init(elev=0, azim=90)
        ax.set_axis_off()
        ax.set_title(title, color='white', fontsize=12, pad=8)

    # Shared colorbar
    sm = plt.cm.ScalarMappable(
        cmap='RdBu_r', norm=plt.Normalize(-vmax, vmax)
    )
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=fig.axes, shrink=0.55, pad=0.02)
    cbar.set_label('z-score', color='white', fontsize=10)
    cbar.ax.yaxis.set_tick_params(color='white')
    plt.setp(cbar.ax.yaxis.get_ticklabels(), color='white')
    # Dashed lines at ±threshold
    norm_t  = (threshold + vmax) / (2 * vmax)
    norm_nt = (-threshold + vmax) / (2 * vmax)
    cbar.ax.axhline(y=norm_t,  xmin=0, xmax=1, color='#facc15', lw=1.5, ls='--')
    cbar.ax.axhline(y=norm_nt, xmin=0, xmax=1, color='#facc15', lw=1.5, ls='--')

    fig.suptitle(cname, color='white', fontsize=13, fontweight='bold', y=1.01)

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=110, bbox_inches='tight',
                facecolor='#111827')
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')


# ---------------------------------------------------------------------------
# Summary helpers
# ---------------------------------------------------------------------------

def _zscore_summary(z: np.ndarray, threshold: float, two_sided: bool) -> dict:
    hist, edges = np.histogram(z, bins=60, range=(-8.0, 8.0))
    return {
        "sig_positive": int(np.sum(z >  threshold)),
        "sig_negative": int(np.sum(z < -threshold)) if two_sided else 0,
        "peak_z":       float(np.max(np.abs(z))),
        "mean_z":       float(np.mean(z)),
        "threshold":    float(threshold),
        "histogram": {
            "counts": hist.tolist(),
            "edges":  np.round(edges, 3).tolist(),
        },
    }


# ---------------------------------------------------------------------------
# Lambda entry point
# ---------------------------------------------------------------------------

def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")

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

        # Lambda sweep
        sweep_mse, sweep_rough = [], []
        for lv in lambda_sweep:
            B = fit_ols(X, Y) if lv == 0.0 else fit_regularized(X, Y, evals, evecs, lv)
            sweep_mse.append(fit_mse(X, Y, B))
            sweep_rough.append(roughness(B, L))

        # Selected lambda
        B_ols = fit_ols(X, Y)
        B_reg = fit_regularized(X, Y, evals, evecs, lam)

        # Contrast maps + images
        contrast_results = {}
        images = {}
        for name, c in contrasts.items():
            z_ols = contrast_zscore(X, Y, B_ols, c)
            z_reg = contrast_zscore(X, Y, B_reg, c)
            contrast_results[name] = {
                "ols": _zscore_summary(z_ols, threshold, two_sided),
                "reg": _zscore_summary(z_reg, threshold, two_sided),
            }
            images[name] = _render_contrast_image(
                mesh, z_ols, z_reg, n_left, threshold, lam, name
            )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({
                "sweep": {
                    "lambdas":   lambda_sweep,
                    "mse":       sweep_mse,
                    "roughness": sweep_rough,
                },
                "selected": {
                    "lambda":         lam,
                    "n_eigenvectors": k,
                    "mse_ols":        fit_mse(X, Y, B_ols),
                    "mse_reg":        fit_mse(X, Y, B_reg),
                    "roughness_ols":  roughness(B_ols, L),
                    "roughness_reg":  roughness(B_reg, L),
                },
                "contrasts": contrast_results,
                "images":    images,
            }),
        }

    except Exception as exc:
        import traceback
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(exc), "trace": traceback.format_exc()}),
        }
