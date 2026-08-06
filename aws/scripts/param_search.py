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


# ============================================================
#  SEARCH SPACE — used by --mode grid (exhaustive).
#
#  Total trials = product of all list lengths.
#  Tip: narrow ranges around promising values for a finer pass.
#
#  NOTE: n_eigenvectors ceiling is 1000 — the web-servable limit. Higher
#  K keeps improving the score (more of the eigenbasis = closer to the
#  exact penalized GLM), but the live 2 GB Lambda can only load ~1000
#  eigenvectors within the API Gateway timeout, so the reported optimum
#  is constrained to what the deployed simulation can actually run.
# ============================================================

SEARCH_SPACE = {
    "lambda":           [0.1, 0.3, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5],
    "n_eigenvectors":   [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
    "p_val":            [1e-5, 1e-4, 1e-3, 5e-3, 1e-2],   # sane fMRI thresholds only
    "cluster_threshold":[8, 9, 10, 11, 12],
}


# ADAPTIVE_BOUNDS + all GLM math now live in the shared module core_glm.py,
# imported by param_search_multi.py and the Lambda handler too (single source).
from core_glm import (ADAPTIVE_BOUNDS, norm, fit_ols, fit_regularized, fit_mse,
                      roughness, contrast_zscore, _apply_cluster_threshold,
                      _sig_mask, _map_corr, _dice, _evaluate, compute_score)


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
