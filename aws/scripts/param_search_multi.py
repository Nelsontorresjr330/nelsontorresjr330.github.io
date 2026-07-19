"""
param_search_multi.py — Multi-dataset hyperparameter search (Bayesian / Optuna).

Scores each parameter set by the AVERAGE reg-vs-OLS improvement across several
nilearn datasets (prepared by prep_multi.py). The reg-vs-OLS comparison is done
WITHIN each dataset (matched X, Y), then the per-dataset improvements are
averaged — so a winning parameter set must generalise across datasets rather
than overfit one. All math (fit, evaluate, score) is imported from
param_search.py, so scores are identical in definition to the single-dataset run.

Setup + usage:
    python aws/scripts/prep_multi.py --out-dir ./local_data_multi        # once
    python aws/scripts/param_search_multi.py \
        --eigenbasis-dir ./local_data \
        --datasets-dir  ./local_data_multi \
        --study-db multi.db --out multi_results.json           # runs until Ctrl+C

Requirements: numpy scipy optuna  (+ the shared eigenbasis in --eigenbasis-dir)
"""
import argparse
import os
import sys
import threading
import time
from pathlib import Path

import numpy as np
from scipy import sparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import param_search as ps   # reuse fit_ols, fit_regularized, _evaluate, compute_score, ADAPTIVE_BOUNDS


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def load_eigenbasis(d):
    d = Path(d)
    evals = np.load(d / "evals.npy")
    evecs = np.load(d / "evecs.npy")
    L = sparse.load_npz(d / "L.npz").tocsr()
    print(f"Eigenbasis: evecs={evecs.shape}  L={L.shape}")
    return evals, evecs, L


def load_datasets(d):
    d = Path(d)
    out = []
    for sub in sorted(p for p in d.iterdir() if p.is_dir()):
        X = np.load(sub / "X.npy")
        Y = np.load(sub / "Y.npy")
        cz = np.load(sub / "contrasts.npz")
        contrasts = {k: cz[k] for k in cz.files}
        out.append((sub.name, X, Y, contrasts))
        print(f"  dataset {sub.name:16} X={X.shape}  Y={Y.shape}  #contrasts={len(contrasts)}")
    return out


# ---------------------------------------------------------------------------
# Scoring — reuses param_search math exactly
# ---------------------------------------------------------------------------

def score_one(params, X, Y, evals_full, evecs_full, L, contrasts):
    lam = params["lambda"]
    k   = min(params["n_eigenvectors"], evals_full.shape[0])
    pv  = params["p_val"]
    thr = float(ps.norm.isf(pv)) if pv > 0 else float(ps.norm.isf(1e-12))
    cs  = params["cluster_threshold"]
    evals = evals_full[:k]; evecs = evecs_full[:, :k]
    B_ols = ps.fit_ols(X, Y)
    B_reg = ps.fit_regularized(X, Y, evals, evecs, lam, B_ols)
    ev = ps._evaluate(X, Y, evals, evecs, lam, B_ols, B_reg, contrasts, thr, True, cs, L)
    s, _ = ps.compute_score(ev)
    return s


def score_multi(params, eb, datasets):
    evals_full, evecs_full, L = eb
    per = {name: score_one(params, X, Y, evals_full, evecs_full, L, con)
           for (name, X, Y, con) in datasets}
    combined = float(np.mean(list(per.values())))
    return combined, per


# ---------------------------------------------------------------------------
# Adaptive search
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--eigenbasis-dir", default="./local_data")
    ap.add_argument("--datasets-dir",   default="./local_data_multi")
    ap.add_argument("--study-db",       default="multi_study.db")
    ap.add_argument("--out",            default="multi_results.json")
    ap.add_argument("--n-trials",       type=int, default=None, help="default: run until Ctrl+C")
    ap.add_argument("--seed",           type=int, default=42)
    ap.add_argument("--workers",        type=int, default=-1)
    args = ap.parse_args()

    try:
        import optuna
    except ImportError:
        sys.exit("Requires Optuna:  pip install optuna")
    optuna.logging.set_verbosity(optuna.logging.WARNING)

    eb = load_eigenbasis(args.eigenbasis_dir)
    datasets = load_datasets(args.datasets_dir)
    names = [n for n, *_ in datasets]
    B = ps.ADAPTIVE_BOUNDS

    sampler = optuna.samplers.TPESampler(n_startup_trials=20, seed=args.seed, multivariate=True)
    study = optuna.create_study(study_name="laplacian_glm_multi",
                                storage=f"sqlite:///{args.study_db}",
                                sampler=sampler, direction="maximize", load_if_exists=True)

    results, best = [], None
    t0 = time.time()
    lock = threading.Lock()
    n_jobs = (os.cpu_count() or 1) if args.workers == -1 else args.workers

    # Re-hydrate prior trials from the study so best / results / JSON reflect the
    # FULL history on resume (Optuna keeps every trial in the db; this restores
    # the script's own view of them). per_dataset is recovered from user_attrs.
    for t in study.trials:
        if t.state.name == "COMPLETE" and t.value is not None and "log10_p_val" in t.params:
            params = {
                "lambda":            t.params["lambda"],
                "n_eigenvectors":    t.params["n_eigenvectors"],
                "p_val":             10.0 ** t.params["log10_p_val"],
                "cluster_threshold": t.params["cluster_threshold"],
            }
            entry = {"params": params, "combined": t.value,
                     "per_dataset": t.user_attrs.get("per_dataset", {})}
            results.append(entry)
            if best is None or t.value > best["combined"]:
                best = entry
    if results:
        # Older trials may lack the stored breakdown — recompute it for the best.
        if not best["per_dataset"]:
            _, best["per_dataset"] = score_multi(best["params"], eb, datasets)
        print(f"Resuming study — {len(results)} prior trials loaded "
              f"(best {best['combined']*100:+.2f}%).")
        _print_best(best, len(results), 0.0, names)

    def objective(trial):
        nonlocal best
        params = {
            "lambda":            trial.suggest_float("lambda", *B["lambda"]),
            "n_eigenvectors":    trial.suggest_int("n_eigenvectors", *B["n_eigenvectors"]),
            "p_val":             10.0 ** trial.suggest_float("log10_p_val", *B["log10_p_val"]),
            "cluster_threshold": trial.suggest_int("cluster_threshold", *B["cluster_threshold"]),
        }
        combined, per = score_multi(params, eb, datasets)
        trial.set_user_attr("per_dataset", per)   # persist breakdown for future resumes
        with lock:
            n = len(results) + 1
            is_best = best is None or combined > best["combined"]
            entry = {"params": params, "combined": combined, "per_dataset": per}
            results.append(entry)
            if is_best:
                best = entry
            tag = "  *** NEW BEST ***" if is_best else ""
            per_str = "  ".join(f"{k}={v*100:+.1f}%" for k, v in per.items())
            print(f"trial {n:>4}  combined={combined*100:>+6.2f}%  [{per_str}]"
                  f"  λ={params['lambda']:.3f} K={params['n_eigenvectors']} "
                  f"p={params['p_val']:.1e} c={params['cluster_threshold']}{tag}")
            if is_best or n % 25 == 0:
                _print_best(best, n, time.time() - t0, names)
        return combined

    print(f"\nMulti-dataset adaptive search over {len(datasets)} datasets: {names}")
    print("Bounds:", {k: B[k] for k in B})
    print("Press Ctrl+C to stop and save.\n")
    try:
        study.optimize(objective, n_trials=args.n_trials, n_jobs=n_jobs, show_progress_bar=False)
    except KeyboardInterrupt:
        print("\nInterrupted — saving results so far.")

    import json
    results.sort(key=lambda r: r["combined"], reverse=True)
    with open(args.out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved {len(results)} trials to {args.out}")
    _print_best(best, len(results), time.time() - t0, names)


def _print_best(best, n, elapsed, names):
    p = best["params"]
    print(f"\n{'─'*74}")
    print(f"  CURRENT BEST  (after {n} trials  {elapsed:.0f}s)")
    print(f"{'─'*74}")
    print(f"  lambda            = {p['lambda']:.4f}")
    print(f"  n_eigenvectors    = {p['n_eigenvectors']}")
    print(f"  p_val             = {p['p_val']:.2e}")
    print(f"  cluster_threshold = {p['cluster_threshold']}")
    print(f"  COMBINED score    = {best['combined']*100:+.2f}%")
    for name in names:
        v = best["per_dataset"].get(name)
        print(f"    {name:16} {v*100:>+7.2f}%" if v is not None else f"    {name:16}     n/a")
    print(f"{'─'*74}")


if __name__ == "__main__":
    main()
