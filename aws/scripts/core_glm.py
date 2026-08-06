"""Shared GLM math: OLS vs Laplacian-regularized fit, plus the evaluation metrics.

Single source of truth. Imported by the search (param_search.py,
param_search_multi.py) and the Lambda backend (handler.py) so all three run the
identical computation. Pure NumPy/SciPy — no plotting or I/O here.

Shapes:  X (T, p)   Y (T, N)   B (p, N)   evecs (N, K)   evals (K,)
  T=timepoints, p=regressors, N=vertices, K=eigenvectors kept.
  B: each column = one vertex; each row = one activation map ("beta" map).
"""
import numpy as np
from scipy.sparse.csgraph import connected_components as _sparse_cc
from scipy.stats import norm

# search ranges for the four tunable parameters
ADAPTIVE_BOUNDS = {
    "lambda":            (0.05, 3.00),
    "n_eigenvectors":    (50,   1000),
    "log10_p_val":       (-5.0, -1.3),   # p from 1e-5 to ~0.05
    "cluster_threshold": (5,    20),
}


# --- fitting ---------------------------------------------------------------

def fit_ols(X, Y):
    return np.linalg.lstsq(X, Y, rcond=None)[0]                       # B (p, N)

def fit_regularized(X, Y, evals, evecs, lam, B_ols):
    XtX      = X.T @ X                                                # (p, p)
    R        = (X.T @ Y) @ evecs                                     # (p, K)  data in the K modes
    sigma, U = np.linalg.eigh(XtX)                                   # diagonalize the design side
    sigma    = np.maximum(sigma, 1e-12)
    UtR      = U.T @ R
    C_ols    = U @ (UtR / sigma[:, None])                            # OLS in the eigenbasis
    C_reg    = U @ (UtR / (sigma[:, None] + lam * evals[None, :]))   # shrink each mode: sigma/(sigma+lam*e)
    return B_ols + (C_reg - C_ols) @ evecs.T                         # correct K modes; rest stay at OLS

def fit_mse(X, Y, B):
    return float(np.mean((Y - X @ B) ** 2))

def roughness(B, L):
    # the penalty term made explicit: tr(B L B^T)/N.  NOT called during fitting —
    # fit_regularized applies the penalty implicitly via the shrinkage above.
    return float(np.trace(B @ (L @ B.T)) / B.shape[1])

def contrast_zscore(X, Y, B, c):                                      # c (p,) -> z (N,)
    T, p     = X.shape
    resid    = Y - X @ B
    sigma2   = np.sum(resid ** 2, axis=0) / (T - p)                  # per-vertex residual variance
    se_scale = float(c @ np.linalg.inv(X.T @ X) @ c)
    return (c @ B) / np.sqrt(sigma2 * se_scale + 1e-12)


# --- significance helpers --------------------------------------------------

def _apply_cluster_threshold(mask, L, min_size):
    if min_size <= 1 or not mask.any():
        return mask
    idx   = np.where(mask)[0]
    _, labels = _sparse_cc(L[idx, :][:, idx], directed=False, connection="weak")
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

def _map_corr(z1, z2):
    m = np.isfinite(z1) & np.isfinite(z2)
    return float(np.corrcoef(z1[m], z2[m])[0, 1]) if m.sum() > 1 else 0.0

def _dice(mask1, mask2):
    n = int(np.sum(mask1) + np.sum(mask2))
    return 2 * int(np.sum(mask1 & mask2)) / n if n > 0 else 1.0


# --- the four evaluation metrics (one dataset) -----------------------------

def _evaluate(X, Y, evals, evecs, lam, B_ols, B_reg, contrasts,
              threshold, two_sided=True, cluster_size=1, L=None):
    T = X.shape[0]; odd = np.arange(0, T, 2); eve = np.arange(1, T, 2)

    # 1. generalization: fit on first 80% of timepoints, predict the last 20%
    sp = int(T * 0.8)
    B_ols_tr = fit_ols(X[:sp], Y[:sp])
    B_reg_tr = fit_regularized(X[:sp], Y[:sp], evals, evecs, lam, B_ols_tr)
    held_out_mse = {"ols": fit_mse(X[sp:], Y[sp:], B_ols_tr),
                    "reg": fit_mse(X[sp:], Y[sp:], B_reg_tr)}

    # 2. recovery: OLS fit + calibrated noise as ground truth, see who recovers it
    rng = np.random.default_rng(42)
    Y_syn = X @ B_ols + rng.normal(0.0, float(np.std(Y - X @ B_ols)), Y.shape)
    B_ols_sy = fit_ols(X, Y_syn)
    B_reg_sy = fit_regularized(X, Y_syn, evals, evecs, lam, B_ols_sy)
    semi_synthetic = {}
    for name, c in contrasts.items():
        z_true = contrast_zscore(X, Y, B_ols, c)
        semi_synthetic[name] = {
            "recovery_corr_ols": _map_corr(z_true, contrast_zscore(X, Y_syn, B_ols_sy, c)),
            "recovery_corr_reg": _map_corr(z_true, contrast_zscore(X, Y_syn, B_reg_sy, c)),
        }

    # 3. reproducibility: fit odd vs even timepoints, correlate the two maps
    B_ols_odd = fit_ols(X[odd], Y[odd]); B_ols_eve = fit_ols(X[eve], Y[eve])
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

    # 4. HRF consistency: design-explained variance (R^2) at each method's sig vertices
    SS_res = np.sum((Y - X @ B_ols) ** 2, axis=0)
    SS_tot = np.sum((Y - Y.mean(axis=0, keepdims=True)) ** 2, axis=0)
    r2 = np.clip(1.0 - SS_res / (SS_tot + 1e-12), 0.0, 1.0)
    hrf_consistency = {}
    for name, c in contrasts.items():
        sig_o = _sig_mask(contrast_zscore(X, Y, B_ols, c), threshold, two_sided, cluster_size, L)
        sig_r = _sig_mask(contrast_zscore(X, Y, B_reg, c), threshold, two_sided, cluster_size, L)
        mr2 = lambda m: (float(np.mean(r2[m])) if m.any() else None)
        hrf_consistency[name] = {"r2_ols_sig": mr2(sig_o), "r2_reg_sig": mr2(sig_r),
                                 "r2_ols_only": mr2(sig_o & ~sig_r),
                                 "r2_reg_only": mr2(sig_r & ~sig_o)}

    return {"held_out_mse": held_out_mse, "semi_synthetic": semi_synthetic,
            "reproducibility": reproducibility, "hrf_consistency": hrf_consistency}


def compute_score(ev):
    """Average relative improvement of reg over OLS across the 4 metrics.

    All four dimensions always contribute (fixed denominator). An empty
    regularized significant-set where OLS found signal scores as a failure, so
    extreme thresholds cannot inflate the score by dropping a dimension.
    """
    eps = 1e-9; dims = {}
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
        if ro is not None and rr is not None: hrf_vals.append((rr - ro) / (abs(ro) + eps))
        elif ro is not None and rr is None:   hrf_vals.append(-1.0)
        else:                                 hrf_vals.append(0.0)
    dims["hrf_consistency"] = sum(hrf_vals) / len(hrf_vals) if hrf_vals else 0.0
    overall = sum(dims.values()) / len(dims)
    return overall, dims
