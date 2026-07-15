"""
param_search.py — Hyperparameter search for the Laplacian-penalized GLM.

Two modes
---------
  --mode adaptive  (default) Bayesian optimisation via Optuna TPE.
                   Proposes the next best candidate after every result.
                   Runs until Ctrl+C or --n-trials is reached.
                   Requires:  pip install optuna

  --mode grid      Exhaustive grid over SEARCH_SPACE (original behaviour).

Usage
-----
    # Adaptive — best for open-ended exploration:
    python aws/scripts/param_search.py --data-dir ./local_data

    # Resume a previous adaptive run (stored in SQLite):
    python aws/scripts/param_search.py --data-dir ./local_data --study-db run1.db

    # Cap at 200 trials then stop:
    python aws/scripts/param_search.py --data-dir ./local_data --n-trials 200

    # Original grid search:
    python aws/scripts/param_search.py --data-dir ./local_data --mode grid

    # Download data locally first (saves time on repeated runs):
    aws s3 sync s3://laplacian-glm-data/data ./local_data --region us-east-1

Requirements (grid):     pip install numpy scipy joblib
Requirements (adaptive): pip install numpy scipy joblib optuna
"""

import argparse
import io
import itertools
import json
import os
import sys
import threading
import time
from pathlib import Path

import numpy as np
from scipy import sparse
from scipy.sparse.csgraph import connected_components as _sparse_cc
from scipy.stats import norm


# ============================================================
#  SEARCH SPACE — used by --mode grid (exhaustive).
#
#  Total trials = product of all list lengths.
#  Tip: narrow ranges around promising values for a finer pass.
#
#  NOTE: n_eigenvectors ceiling raised to 10000. Successive searches
#  kept converging to the boundary (K~998 at [.,1000], K~1990 at
#  [.,2000]), so the ceiling was pushed to 10000 (~half of the 20484
#  vertices) to locate where the optimum finally plateaus.
# ============================================================

SEARCH_SPACE = {
    "lambda":           [0.1, 0.3, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5],
    "n_eigenvectors":   [500, 1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000],
    "p_val":            [1e-5, 1e-4, 1e-3, 5e-3, 1e-2],   # sane fMRI thresholds only
    "cluster_threshold":[8, 9, 10, 11, 12],
}


# ============================================================
#  ADAPTIVE BOUNDS — used by --mode adaptive (Bayesian optimisation).
#
#  Each param is searched continuously within [lo, hi].
#  Integer params are rounded; p_val is searched in log10 space.
#  Widen these if the best result keeps landing on a boundary.
#
#  NOTE: n_eigenvectors ceiling raised 2000 -> 10000. Searches keep
#  converging to the boundary (K~998 at 1000, K~1990 at 2000), so the
#  ceiling was pushed to 10000 (~half of the 20484 vertices) to find
#  where the optimum plateaus. Backend now precomputes 10000.
#  Run with a FRESH --study-db so stale K<=2000 trials don't bias TPE.
# ============================================================

ADAPTIVE_BOUNDS = {
    "lambda":           (0.05, 3.00),    # continuous float
    "n_eigenvectors":   (50,   10000),   # integer — raised ceiling, was capping out at 2000
    "log10_p_val":      (-5.0, -1.3),   # log10 of p_val; maps to 1e-5 … ~0.05 (sane thresholds)
    "cluster_threshold":(5,    20),      # integer
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
    sigma2   = np.sum(resid ** 2, axis=0) / (T - p)
    se_scale = float(c @ np.linalg.inv(X.T @ X) @ c)
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

    sp       = int(T * 0.8)
    B_ols_tr = fit_ols(X[:sp], Y[:sp])
    B_reg_tr = fit_regularized(X[:sp], Y[:sp], evals, evecs, lam, B_ols_tr)
    held_out_mse = {
        "ols": fit_mse(X[sp:], Y[sp:], B_ols_tr),
        "reg": fit_mse(X[sp:], Y[sp:], B_reg_tr),
    }

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

    All FOUR dimensions ALWAYS contribute (fixed denominator = 4). This is
    deliberate: an earlier version dropped the HRF dimension whenever the
    regularized significant-vertex set was empty, which let extreme p-values
    game the score (empty maps -> fewer dimensions -> inflated average). Now an
    empty regularized set where OLS detected signal is scored as a failure.
    """
    eps  = 1e-9
    dims = {}

    # 1. Generalization — lower held-out MSE is better
    mo, mr = ev["held_out_mse"]["ols"], ev["held_out_mse"]["reg"]
    dims["generalization"] = (mo - mr) / (mo + eps)

    # 2. Recovery — higher correlation with the true map is better
    ss = list(ev["semi_synthetic"].values())
    dims["recovery"] = sum(
        (v["recovery_corr_reg"] - v["recovery_corr_ols"]) / (abs(v["recovery_corr_ols"]) + eps)
        for v in ss
    ) / len(ss)

    # 3. Reproducibility — higher split-half map correlation is better
    rp = list(ev["reproducibility"].values())
    dims["reproducibility"] = sum(
        (v["map_corr_reg"] - v["map_corr_ols"]) / (abs(v["map_corr_ols"]) + eps)
        for v in rp
    ) / len(rp)

    # 4. HRF consistency — R2 at each method's significant vertices.
    #    Per contrast: both defined  -> relative improvement;
    #                  reg empty only -> failure (reg detected nothing where OLS did);
    #                  otherwise      -> neutral (0) so it can't inflate the average.
    hrf_vals = []
    for v in ev["hrf_consistency"].values():
        ro, rr = v["r2_ols_sig"], v["r2_reg_sig"]
        if ro is not None and rr is not None:
            hrf_vals.append((rr - ro) / (abs(ro) + eps))
        elif ro is not None and rr is None:
            hrf_vals.append(-1.0)   # reg found no significant vertices where OLS did
        else:
            hrf_vals.append(0.0)
    dims["hrf_consistency"] = sum(hrf_vals) / len(hrf_vals) if hrf_vals else 0.0

    overall = sum(dims.values()) / len(dims)   # always 4 dimensions
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
#  Single trial — called in both modes
# ============================================================

def _run_trial(trial_params, X, Y, evals_full, evecs_full, L, contrasts):
    lam       = trial_params["lambda"]
    k         = min(trial_params["n_eigenvectors"], evals_full.shape[0])
    p_val     = trial_params["p_val"]
    threshold = float(norm.isf(p_val)) if p_val > 0 else float(norm.isf(1e-12))
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
#  Display helpers
# ============================================================

_COL = 82

def _print_best(best, n_done, n_total=None, elapsed=None):
    """Print a compact current-best panel."""
    frac  = f"{n_done}/{n_total}" if n_total else str(n_done)
    t_str = f"  {elapsed:.0f}s elapsed" if elapsed else ""
    print(f"\n{'─'*_COL}")
    print(f"  CURRENT BEST  (after {frac} trials{t_str})")
    print(f"{'─'*_COL}")
    p = best["params"]
    print(f"  lambda             = {p['lambda']:.4f}")
    print(f"  n_eigenvectors     = {p['n_eigenvectors']}")
    print(f"  p_val              = {p['p_val']:.2e}")
    print(f"  cluster_threshold  = {p['cluster_threshold']}")
    print(f"  Overall score      = {best['score']*100:+.2f}%")
    print(f"  Per-dimension:")
    for dim, val in best["dims"].items():
        bar  = "█" * max(0, int(abs(val) * 200))
        sign = "+" if val >= 0 else "-"
        print(f"    {dim:20s}  {val*100:>+7.2f}%  {sign}{bar}")
    print(f"{'─'*_COL}")


def _print_top(results, top_n):
    top_n = min(top_n, len(results))
    print(f"\n{'='*_COL}")
    print(f"  TOP {top_n} / {len(results):,} TRIALS")
    print(f"{'='*_COL}")
    hdr = (f"{'#':>3}  {'Score':>7}  {'λ':>8}  {'K':>4}  {'p_val':>9}  {'clust':>5}"
           f"  {'Generz':>7}  {'Recov':>7}  {'Repro':>7}  {'HRF':>7}")
    print(hdr)
    print("-" * len(hdr))
    for rank, r in enumerate(results[:top_n], 1):
        p = r["params"]
        d = r["dims"]
        print(
            f"{rank:>3}  {r['score']*100:>+7.2f}%"
            f"  {p['lambda']:>8.4f}"
            f"  {p['n_eigenvectors']:>4}"
            f"  {p['p_val']:>9.2e}"
            f"  {p['cluster_threshold']:>5}"
            f"  {d.get('generalization', float('nan'))*100:>+7.2f}%"
            f"  {d.get('recovery', float('nan'))*100:>+7.2f}%"
            f"  {d.get('reproducibility', float('nan'))*100:>+7.2f}%"
            f"  {d.get('hrf_consistency', float('nan'))*100:>+7.2f}%"
        )


# ============================================================
#  Grid search (original mode)
# ============================================================

def run_grid(X, Y, evals_full, evecs_full, L, contrasts, workers, top_n, out):
    keys   = list(SEARCH_SPACE.keys())
    combos = list(itertools.product(*[SEARCH_SPACE[k] for k in keys]))
    trials = [{keys[i]: c[i] for i in range(len(keys))} for c in combos]
    total  = len(trials)

    print(f"\nSearch space: {total:,} combinations")
    for k, vals in SEARCH_SPACE.items():
        print(f"  {k:20s}: {vals}")

    t0 = time.time()
    print(f"\nRunning {total:,} trials ({'all cores' if workers == -1 else str(workers) + ' workers'})...")

    try:
        from joblib import Parallel, delayed
        results = Parallel(n_jobs=workers, verbose=2)(
            delayed(_run_trial)(p, X, Y, evals_full, evecs_full, L, contrasts)
            for p in trials
        )
    except ImportError:
        print("  (joblib not installed — running sequentially)")
        results, t_check = [], time.time()
        for i, p in enumerate(trials, 1):
            results.append(_run_trial(p, X, Y, evals_full, evecs_full, L, contrasts))
            if time.time() - t_check > 10:
                eta = (time.time() - t0) / i * (total - i)
                print(f"  {i:>5}/{total}  (~{eta:.0f}s remaining)")
                t_check = time.time()

    elapsed = time.time() - t0
    results.sort(key=lambda r: r["score"], reverse=True)

    with open(out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nAll {total:,} results saved to {out}  (total {elapsed:.1f}s)")

    _print_top(results, top_n)
    _print_best(results[0], total, total, elapsed)


# ============================================================
#  Adaptive search (Bayesian optimisation via Optuna)
# ============================================================

def run_adaptive(X, Y, evals_full, evecs_full, L, contrasts,
                 n_trials, study_db, out, top_n, seed, workers=-1):
    try:
        import optuna
    except ImportError:
        sys.exit("Adaptive mode requires Optuna:  pip install optuna")

    optuna.logging.set_verbosity(optuna.logging.WARNING)

    storage = f"sqlite:///{study_db}"
    sampler = optuna.samplers.TPESampler(
        n_startup_trials=20,   # random exploration before TPE kicks in
        seed=seed,
        multivariate=True,     # model param correlations
    )
    study = optuna.create_study(
        study_name="laplacian_glm",
        storage=storage,
        sampler=sampler,
        direction="maximize",
        load_if_exists=True,
    )

    existing = len(study.trials)
    if existing:
        print(f"  Resuming study — {existing} trials already completed.")

    results   = []
    best_ever = None
    t0        = time.time()
    _lock     = threading.Lock()
    n_cores   = os.cpu_count() or 1
    n_jobs    = n_cores if workers == -1 else workers

    # Re-hydrate any previously completed trials into results list
    for t in study.trials:
        if t.state.name == "COMPLETE" and t.value is not None:
            p_val = 10.0 ** t.params["log10_p_val"]
            params = {
                "lambda":           t.params["lambda"],
                "n_eigenvectors":   t.params["n_eigenvectors"],
                "p_val":            p_val,
                "cluster_threshold":t.params["cluster_threshold"],
            }
            entry = {"params": params, "score": t.value, "dims": {}}
            results.append(entry)
            if best_ever is None or t.value > best_ever["score"]:
                best_ever = entry

    def objective(trial):
        nonlocal best_ever

        lam   = trial.suggest_float("lambda",
                                    ADAPTIVE_BOUNDS["lambda"][0],
                                    ADAPTIVE_BOUNDS["lambda"][1])
        k     = trial.suggest_int("n_eigenvectors",
                                   ADAPTIVE_BOUNDS["n_eigenvectors"][0],
                                   ADAPTIVE_BOUNDS["n_eigenvectors"][1])
        log_p = trial.suggest_float("log10_p_val",
                                    ADAPTIVE_BOUNDS["log10_p_val"][0],
                                    ADAPTIVE_BOUNDS["log10_p_val"][1])
        csize = trial.suggest_int("cluster_threshold",
                                   ADAPTIVE_BOUNDS["cluster_threshold"][0],
                                   ADAPTIVE_BOUNDS["cluster_threshold"][1])
        p_val = 10.0 ** log_p

        params = {
            "lambda":           lam,
            "n_eigenvectors":   k,
            "p_val":            p_val,
            "cluster_threshold":csize,
        }

        r = _run_trial(params, X, Y, evals_full, evecs_full, L, contrasts)

        with _lock:
            nonlocal best_ever
            n_done      = len(results) + 1
            is_new_best = best_ever is None or r["score"] > best_ever["score"]
            results.append(r)
            if is_new_best:
                best_ever = r
            elapsed = time.time() - t0
            tag     = " *** NEW BEST ***" if is_new_best else ""
            print(f"  trial {n_done:>4}  score={r['score']*100:>+7.2f}%"
                  f"  λ={lam:.4f}  K={k}  p={p_val:.1e}  clust={csize}{tag}")
            if is_new_best or n_done % 10 == 0:
                _print_best(best_ever, n_done, elapsed=elapsed)

        return r["score"]

    limit = n_trials if n_trials else None
    n_label = f"{limit:,}" if limit else "∞"
    print(f"\nAdaptive search  (n_trials={n_label}, workers={n_jobs}/{n_cores} cores, study_db={study_db})")
    print(f"Bounds:")
    for k, (lo, hi) in ADAPTIVE_BOUNDS.items():
        print(f"  {k:22s}: [{lo}, {hi}]")
    print(f"\nPress Ctrl+C at any time to stop and see final results.\n")

    try:
        study.optimize(objective, n_trials=limit, n_jobs=n_jobs, show_progress_bar=False)
    except KeyboardInterrupt:
        print("\n\nInterrupted — showing results so far.")

    # ── Final output ───────────────────────────────────────
    elapsed = time.time() - t0
    results.sort(key=lambda r: r["score"], reverse=True)

    with open(out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n{len(results):,} results saved to {out}  (total {elapsed:.1f}s)")

    _print_top(results, top_n)
    if results:
        _print_best(results[0], len(results), elapsed=elapsed)

    # Print search boundary warnings (best near edge → suggest expanding bounds)
    if results:
        b = results[0]["params"]
        lo_lam, hi_lam = ADAPTIVE_BOUNDS["lambda"]
        lo_k,   hi_k   = ADAPTIVE_BOUNDS["n_eigenvectors"]
        lo_c,   hi_c   = ADAPTIVE_BOUNDS["cluster_threshold"]
        lo_lp,  hi_lp  = ADAPTIVE_BOUNDS["log10_p_val"]
        log_p_best = np.log10(b["p_val"]) if b["p_val"] > 0 else lo_lp
        warnings = []
        if abs(b["lambda"] - lo_lam) < 0.05 or abs(b["lambda"] - hi_lam) < 0.05:
            warnings.append(f"  lambda={b['lambda']:.4f} is near a bound [{lo_lam}, {hi_lam}]")
        if abs(b["n_eigenvectors"] - lo_k) <= 5 or abs(b["n_eigenvectors"] - hi_k) <= 5:
            warnings.append(f"  n_eigenvectors={b['n_eigenvectors']} is near a bound [{lo_k}, {hi_k}]")
        if abs(b["cluster_threshold"] - lo_c) <= 1 or abs(b["cluster_threshold"] - hi_c) <= 1:
            warnings.append(f"  cluster_threshold={b['cluster_threshold']} is near a bound [{lo_c}, {hi_c}]")
        if abs(log_p_best - lo_lp) < 0.5 or abs(log_p_best - hi_lp) < 0.5:
            warnings.append(f"  p_val={b['p_val']:.1e} (log={log_p_best:.1f}) is near a bound [{lo_lp}, {hi_lp}]")
        if warnings:
            print(f"\n  ⚠  Best result is near a search boundary — consider widening ADAPTIVE_BOUNDS:")
            for w in warnings:
                print(w)


# ============================================================
#  Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Hyperparameter search for the Laplacian GLM.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--data-dir", metavar="DIR",
                     help="Local directory with .npy / .npz data files")
    src.add_argument("--bucket",   metavar="NAME",
                     help="S3 bucket (downloads data automatically)")
    parser.add_argument("--region",    default="us-east-1", metavar="REGION")
    parser.add_argument("--mode",      default="adaptive", choices=["adaptive", "grid"],
                        help="Search mode (default: adaptive)")
    parser.add_argument("--n-trials",  type=int, default=None,
                        help="Adaptive mode: max trials (default: run until Ctrl+C)")
    parser.add_argument("--study-db",  default="adaptive_study.db",
                        help="SQLite file for adaptive study state (enables resume)")
    parser.add_argument("--seed",      type=int, default=42,
                        help="Random seed for sampler (default: 42)")
    parser.add_argument("--workers",   type=int, default=-1,
                        help="Parallel workers for both modes (-1 = all cores, default)")
    parser.add_argument("--top",       type=int, default=15,
                        help="Number of top results to print (default: 15)")
    parser.add_argument("--out",       default="search_results.json",
                        help="JSON file for all ranked results (default: search_results.json)")
    args = parser.parse_args()

    if args.data_dir:
        X, Y, evals_full, evecs_full, L, contrasts = load_from_dir(args.data_dir)
    else:
        X, Y, evals_full, evecs_full, L, contrasts = load_from_s3(args.bucket, args.region)

    if args.mode == "grid":
        run_grid(X, Y, evals_full, evecs_full, L, contrasts,
                 args.workers, args.top, args.out)
    else:
        run_adaptive(X, Y, evals_full, evecs_full, L, contrasts,
                     args.n_trials, args.study_db, args.out, args.top, args.seed, args.workers)


if __name__ == "__main__":
    main()
