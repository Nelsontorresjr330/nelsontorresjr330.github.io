"""
param_search.py — Local hyperparameter search for the Laplacian-penalized GLM.

Tests every combination in SEARCH_SPACE, scores each with the same 4-dimension
combined metric used in the web simulation, and reports the top results.

Usage
-----
# Point at a local data directory (fastest — no network):
    python aws/scripts/param_search.py --data-dir ./local_data

# Or download directly from S3 (requires AWS credentials):
    python aws/scripts/param_search.py --bucket laplacian-glm-data --region us-east-1

# Limit parallelism, number of top results shown, and output file:
    python aws/scripts/param_search.py --data-dir ./local_data --workers 4 --top 20 --out best.json

Download data locally first (saves time on repeated runs):
    aws s3 sync s3://laplacian-glm-data/data ./local_data --region us-east-1

Requirements:
    pip install numpy scipy joblib
"""

import argparse
import io
import itertools
import json
import time
from pathlib import Path

import numpy as np
from scipy import sparse
from scipy.sparse.csgraph import connected_components as _sparse_cc
from scipy.stats import norm


# ============================================================
#  SEARCH SPACE — edit these lists freely.
#
#  Total trials = product of all list lengths.
#  Current default: 12 × 4 × 5 × 5 = 1 200 combinations (~10 min on 8 cores).
#  Tip: narrow ranges around promising values for a second-pass fine search.
# ============================================================

SEARCH_SPACE = {
    "lambda": [
        0.01, 0.05, 0.1, 0.2, 0.5,
        1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0,
    ],
    "n_eigenvectors": [100, 200, 300, 500],
    "p_val":          [0.0001, 0.001, 0.005, 0.01, 0.05],
    "cluster_threshold": [1, 10, 20, 50, 100],
}


# ============================================================
#  Math — exact copy of handler.py so scores are comparable
# ============================================================

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


def fit_mse(X, Y, B):
    return float(np.mean((Y - X @ B) ** 2))


def contrast_zscore(X, Y, B, c):
    T, p  = X.shape
    resid = Y - X @ B
    sigma2    = np.sum(resid ** 2, axis=0) / (T - p)
    se_scale  = float(c @ np.linalg.inv(X.T @ X) @ c)
    return (c @ B) / np.sqrt(sigma2 * se_scale + 1e-12)


def _apply_cluster_threshold(mask, L, min_size):
    if min_size <= 1 or not mask.any():
        return mask
    idx   = np.where(mask)[0]
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


def _map_corr(z1, z2):
    m = np.isfinite(z1) & np.isfinite(z2)
    return float(np.corrcoef(z1[m], z2[m])[0, 1]) if m.sum() > 1 else 0.0


def _dice(mask1, mask2):
    n = int(np.sum(mask1) + np.sum(mask2))
    return 2 * int(np.sum(mask1 & mask2)) / n if n > 0 else 1.0


# ============================================================
#  Evaluation — mirrors handler.py _evaluate()
# ============================================================

def _evaluate(X, Y, evals, evecs, lam, B_ols, B_reg, contrasts,
              threshold, two_sided=True, cluster_size=1, L=None):
    T   = X.shape[0]
    odd = np.arange(0, T, 2)
    eve = np.arange(1, T, 2)

    # 1. Held-out MSE (80 / 20 temporal split)
    sp       = int(T * 0.8)
    B_ols_tr = fit_ols(X[:sp], Y[:sp])
    B_reg_tr = fit_regularized(X[:sp], Y[:sp], evals, evecs, lam, B_ols_tr)
    held_out_mse = {
        "ols": fit_mse(X[sp:], Y[sp:], B_ols_tr),
        "reg": fit_mse(X[sp:], Y[sp:], B_reg_tr),
    }

    # 2. Semi-synthetic recovery (fixed seed for reproducibility)
    rng     = np.random.default_rng(42)
    res_std = float(np.std(Y - X @ B_ols))
    Y_syn   = X @ B_ols + rng.normal(0.0, res_std, Y.shape)
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

    # 3. Split-half reproducibility (odd / even timepoints)
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

    # 4. HRF consistency (GLM R² at significant vertices)
    SS_res = np.sum((Y - X @ B_ols) ** 2, axis=0)
    SS_tot = np.sum((Y - Y.mean(axis=0, keepdims=True)) ** 2, axis=0)
    r2     = np.clip(1.0 - SS_res / (SS_tot + 1e-12), 0.0, 1.0)

    hrf_consistency = {}
    for name, c in contrasts.items():
        z_o   = contrast_zscore(X, Y, B_ols, c)
        z_r   = contrast_zscore(X, Y, B_reg, c)
        sig_o = _sig_mask(z_o, threshold, two_sided, cluster_size, L)
        sig_r = _sig_mask(z_r, threshold, two_sided, cluster_size, L)

        def _mr2(mask):
            return float(np.mean(r2[mask])) if mask.any() else None

        hrf_consistency[name] = {
            "r2_ols_sig":  _mr2(sig_o),
            "r2_reg_sig":  _mr2(sig_r),
            "r2_ols_only": _mr2(sig_o & ~sig_r),
            "r2_reg_only": _mr2(sig_r & ~sig_o),
        }

    return {
        "held_out_mse":    held_out_mse,
        "semi_synthetic":  semi_synthetic,
        "reproducibility": reproducibility,
        "hrf_consistency": hrf_consistency,
    }


def compute_score(ev):
    """
    Mirrors computeOverallScore() in LaplacianGLMPage.jsx.
    Returns (overall_score, per_dimension_dict).
    Positive values mean Regularized outperforms OLS on that dimension.
    """
    eps  = 1e-9
    dims = {}

    mo, mr = ev["held_out_mse"]["ols"], ev["held_out_mse"]["reg"]
    dims["generalization"] = (mo - mr) / (mo + eps)

    ss = list(ev["semi_synthetic"].values())
    dims["recovery"] = sum(
        (v["recovery_corr_reg"] - v["recovery_corr_ols"]) / (abs(v["recovery_corr_ols"]) + eps)
        for v in ss
    ) / len(ss)

    rp = list(ev["reproducibility"].values())
    dims["reproducibility"] = sum(
        (v["map_corr_reg"] - v["map_corr_ols"]) / (abs(v["map_corr_ols"]) + eps)
        for v in rp
    ) / len(rp)

    hc = [v for v in ev["hrf_consistency"].values()
          if v["r2_ols_sig"] is not None and v["r2_reg_sig"] is not None]
    if hc:
        dims["hrf_consistency"] = sum(
            (v["r2_reg_sig"] - v["r2_ols_sig"]) / (abs(v["r2_ols_sig"]) + eps)
            for v in hc
        ) / len(hc)

    overall = sum(dims.values()) / len(dims)
    return overall, dims


# ============================================================
#  Data loading
# ============================================================

def load_from_dir(data_dir):
    d = Path(data_dir)
    print(f"Loading data from {d.resolve()} ...")
    X      = np.load(d / "X.npy")
    Y      = np.load(d / "Y.npy")
    evals  = np.load(d / "evals.npy")
    evecs  = np.load(d / "evecs.npy")
    L      = sparse.load_npz(d / "L.npz").tocsr()
    contrasts = {
        "(left - right) button press": np.load(d / "contrast_left_minus_right.npy"),
        "audio - visual":              np.load(d / "contrast_audio_minus_visual.npy"),
        "computation - sentences":     np.load(d / "contrast_computation_minus_sentences.npy"),
    }
    print(f"  X={X.shape}  Y={Y.shape}  evals={evals.shape}  L={L.shape}")
    return X, Y, evals, evecs, L, contrasts


def load_from_s3(bucket, region):
    import boto3
    s3 = boto3.client("s3", region_name=region)

    def _npy(key):
        body = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
        return np.load(io.BytesIO(body), allow_pickle=False)

    def _npz(key):
        body = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
        return sparse.load_npz(io.BytesIO(body)).tocsr()

    print(f"Downloading data from s3://{bucket}/data/ ...")
    X      = _npy("data/X.npy");      print("  X.npy")
    Y      = _npy("data/Y.npy");      print("  Y.npy")
    evals  = _npy("data/evals.npy");  print("  evals.npy")
    evecs  = _npy("data/evecs.npy");  print("  evecs.npy")
    L      = _npz("data/L.npz");      print("  L.npz")
    contrasts = {
        "(left - right) button press": _npy("data/contrast_left_minus_right.npy"),
        "audio - visual":              _npy("data/contrast_audio_minus_visual.npy"),
        "computation - sentences":     _npy("data/contrast_computation_minus_sentences.npy"),
    }
    print(f"  Done.  X={X.shape}  Y={Y.shape}")
    return X, Y, evals, evecs, L, contrasts


# ============================================================
#  Single trial — called in parallel
# ============================================================

def _run_trial(trial_params, X, Y, evals_full, evecs_full, L, contrasts):
    lam       = trial_params["lambda"]
    k         = min(trial_params["n_eigenvectors"], evals_full.shape[0])
    threshold = float(norm.isf(trial_params["p_val"]))
    csize     = trial_params["cluster_threshold"]

    evals = evals_full[:k]
    evecs = evecs_full[:, :k]

    B_ols = fit_ols(X, Y)
    B_reg = fit_regularized(X, Y, evals, evecs, lam, B_ols)

    ev = _evaluate(X, Y, evals, evecs, lam, B_ols, B_reg, contrasts,
                   threshold, two_sided=True, cluster_size=csize, L=L)
    overall, dims = compute_score(ev)

    return {
        "params": trial_params,
        "score":  round(overall, 6),
        "dims":   {k: round(v, 6) for k, v in dims.items()},
    }


# ============================================================
#  Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Grid search over SEARCH_SPACE to find best Laplacian GLM parameters.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--data-dir", metavar="DIR",
                     help="Local directory with .npy / .npz data files")
    src.add_argument("--bucket",   metavar="NAME",
                     help="S3 bucket (downloads data automatically)")
    parser.add_argument("--region",  default="us-east-1", metavar="REGION")
    parser.add_argument("--workers", type=int, default=-1,
                        help="Parallel worker processes (-1 = all CPU cores, default)")
    parser.add_argument("--top",     type=int, default=15,
                        help="Number of top results to print (default 15)")
    parser.add_argument("--out",     default="search_results.json",
                        help="JSON file to write all ranked results (default search_results.json)")
    args = parser.parse_args()

    # ── Load data ──────────────────────────────────────────
    if args.data_dir:
        X, Y, evals_full, evecs_full, L, contrasts = load_from_dir(args.data_dir)
    else:
        X, Y, evals_full, evecs_full, L, contrasts = load_from_s3(args.bucket, args.region)

    # ── Build parameter grid ───────────────────────────────
    keys   = list(SEARCH_SPACE.keys())
    combos = list(itertools.product(*[SEARCH_SPACE[k] for k in keys]))
    trials = [{keys[i]: c[i] for i in range(len(keys))} for c in combos]
    total  = len(trials)

    print(f"\nSearch space: {total:,} combinations")
    for k, vals in SEARCH_SPACE.items():
        print(f"  {k:20s}: {vals}")

    # ── Run ────────────────────────────────────────────────
    t0 = time.time()
    print(f"\nRunning {total:,} trials ({'all cores' if args.workers == -1 else str(args.workers) + ' workers'})...")

    try:
        from joblib import Parallel, delayed
        results = Parallel(n_jobs=args.workers, verbose=2)(
            delayed(_run_trial)(p, X, Y, evals_full, evecs_full, L, contrasts)
            for p in trials
        )
    except ImportError:
        print("  (joblib not installed — running sequentially; pip install joblib to parallelise)")
        results, t_check = [], time.time()
        for i, p in enumerate(trials, 1):
            results.append(_run_trial(p, X, Y, evals_full, evecs_full, L, contrasts))
            if time.time() - t_check > 10:
                eta = (time.time() - t0) / i * (total - i)
                print(f"  {i:>5}/{total}  (~{eta:.0f}s remaining)")
                t_check = time.time()

    elapsed = time.time() - t0
    results.sort(key=lambda r: r["score"], reverse=True)

    # ── Save ───────────────────────────────────────────────
    with open(args.out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nAll {total:,} results saved to {args.out}  (total {elapsed:.1f}s)")

    # ── Print top N ────────────────────────────────────────
    top_n = min(args.top, len(results))
    col   = 80
    print(f"\n{'='*col}")
    print(f"  TOP {top_n} / {total:,} COMBINATIONS")
    print(f"{'='*col}")
    hdr = (f"{'#':>3}  {'Score':>7}  {'λ':>8}  {'K':>4}  {'p_val':>7}  {'clust':>5}"
           f"  {'Generz':>7}  {'Recov':>7}  {'Repro':>7}  {'HRF':>7}")
    print(hdr)
    print("-" * len(hdr))
    for rank, r in enumerate(results[:top_n], 1):
        p = r["params"]
        d = r["dims"]
        print(
            f"{rank:>3}  {r['score']*100:>+7.2f}%"
            f"  {p['lambda']:>8.3f}"
            f"  {p['n_eigenvectors']:>4}"
            f"  {p['p_val']:>7.4f}"
            f"  {p['cluster_threshold']:>5}"
            f"  {d.get('generalization', float('nan'))*100:>+7.2f}%"
            f"  {d.get('recovery', float('nan'))*100:>+7.2f}%"
            f"  {d.get('reproducibility', float('nan'))*100:>+7.2f}%"
            f"  {d.get('hrf_consistency', float('nan'))*100:>+7.2f}%"
        )

    best = results[0]
    print(f"\n{'='*col}")
    print("  BEST PARAMETERS")
    print(f"{'='*col}")
    for k, v in best["params"].items():
        print(f"  {k:22s} = {v}")
    print(f"  {'Overall score':22s} = {best['score']*100:+.2f}%")
    print(f"\n  Per-dimension breakdown:")
    for dim, val in best["dims"].items():
        bar = "█" * int(abs(val) * 200)
        sign = "+" if val >= 0 else "-"
        print(f"    {dim:20s}  {val*100:>+7.2f}%  {sign}{bar}")


if __name__ == "__main__":
    main()
