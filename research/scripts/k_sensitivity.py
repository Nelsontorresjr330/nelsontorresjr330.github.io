"""
k_sensitivity.py — Evaluate COMBINED score across all datasets at every K (step 20).

Mirrors param_search_multi.py exactly: loads the shared eigenbasis from
--eigenbasis-dir, loads every dataset subdirectory from --datasets-dir, scores
each dataset independently at each K, then averages — matching the +21% figure.

Parallelism: workers share large arrays via OS page-cached mmap — no 3 GB
serialization overhead. Each worker scores all datasets at one K value.

Usage:
    python aws/scripts/k_sensitivity.py \
        --eigenbasis-dir ./local_data \
        --datasets-dir   ./local_data_multi
"""

import argparse
import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from scipy import sparse
from scipy.stats import norm

# ── fixed optimal parameters (from multi-dataset Bayesian search) ─────────────
LAM          = 2.66
P_VAL        = 6.5e-5
CLUSTER_SIZE = 19
THRESHOLD    = float(norm.isf(P_VAL))

K_MIN  = 20
K_STEP = 20


def _worker(args):
    """Subprocess worker: scores all datasets at one K, returns combined mean."""
    k, eigenbasis_dir_str, datasets_dir_str = args
    eigenbasis_dir = Path(eigenbasis_dir_str)
    datasets_dir   = Path(datasets_dir_str)

    scripts_dir = str(Path(__file__).parent)
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)

    from core_glm import fit_ols, fit_regularized, _evaluate, compute_score

    # shared eigenbasis — mmap so all workers reuse the same OS page cache
    evals_full = np.load(eigenbasis_dir / "evals.npy", mmap_mode='r')
    evecs_full = np.load(eigenbasis_dir / "evecs.npy", mmap_mode='r')
    L          = sparse.load_npz(eigenbasis_dir / "L.npz").tocsr()

    evals = np.array(evals_full[:k])
    evecs = np.array(evecs_full[:, :k])

    per_dataset = {}
    for sub in sorted(p for p in datasets_dir.iterdir() if p.is_dir()):
        X = np.load(sub / "X.npy",  mmap_mode='r')
        Y = np.load(sub / "Y.npy",  mmap_mode='r')
        cz = np.load(sub / "contrasts.npz")
        contrasts = {key: cz[key] for key in cz.files}

        B_ols = fit_ols(X, Y)
        B_reg = fit_regularized(X, Y, evals, evecs, LAM, B_ols)
        ev    = _evaluate(X, Y, evals, evecs, LAM, B_ols, B_reg, contrasts,
                          THRESHOLD, two_sided=True, cluster_size=CLUSTER_SIZE, L=L)
        score, _ = compute_score(ev)
        per_dataset[sub.name] = round(score * 100, 2)

    combined = round(float(np.mean(list(per_dataset.values()))), 2)
    return {"k": k, "score": combined, "per_dataset": per_dataset}


def run(eigenbasis_dir, datasets_dir, out, n_workers):
    eb = Path(eigenbasis_dir)
    evals_full = np.load(eb / "evals.npy", mmap_mode='r')
    max_k = int(evals_full.shape[0])

    dataset_names = sorted(p.name for p in Path(datasets_dir).iterdir() if p.is_dir())
    k_values = list(range(K_MIN, max_k + 1, K_STEP))
    if k_values[-1] != max_k:
        k_values.append(max_k)

    n_workers = min(n_workers, len(k_values))
    print(f"Datasets: {dataset_names}")
    print(f"Sweeping {len(k_values)} K values: {k_values[0]} → {k_values[-1]} (step {K_STEP})")
    print(f"Fixed: lambda={LAM}, p_val={P_VAL:.1e}, cluster={CLUSTER_SIZE}")
    print(f"Workers: {n_workers}  |  eigenbasis: {max_k} modes (mmap shared)\n")

    header = f"{'K':>6}  {'Combined':>9}  " + "  ".join(f"{n[:10]:>10}" for n in dataset_names) + "  Elapsed"
    print(header)
    print("-" * len(header))

    results = []
    t0 = time.time()
    args = [(k, str(eb), str(datasets_dir)) for k in k_values]

    with ProcessPoolExecutor(max_workers=n_workers) as pool:
        futures = {pool.submit(_worker, a): a[0] for a in args}
        for fut in as_completed(futures):
            row = fut.result()
            results.append(row)
            elapsed = time.time() - t0
            per_str = "  ".join(f"{row['per_dataset'].get(n, 0):>+9.2f}%" for n in dataset_names)
            print(f"{row['k']:>6}  {row['score']:>+8.2f}%  {per_str}  {elapsed:>6.1f}s")

            results_sorted = sorted(results, key=lambda r: r["k"])
            with open(out, "w") as f:
                json.dump(results_sorted, f, indent=2)

    results_sorted = sorted(results, key=lambda r: r["k"])
    with open(out, "w") as f:
        json.dump(results_sorted, f, indent=2)

    total = time.time() - t0
    print(f"\n{len(results)} evaluations in {total:.1f}s — saved to {out}")
    print("\n── Paste this into the figure artifact ──")
    print(json.dumps([[r["k"], r["score"]] for r in results_sorted]))


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--eigenbasis-dir", default="./local_data",
                        help="Directory with evals.npy, evecs.npy, L.npz")
    parser.add_argument("--datasets-dir", default="./local_data_multi",
                        help="Directory of dataset subdirs (each with X.npy, Y.npy, contrasts.npz)")
    parser.add_argument("--out", default="k_sensitivity.json")
    parser.add_argument("--workers", type=int, default=os.cpu_count(),
                        help="Parallel workers (default: all CPU cores)")
    args = parser.parse_args()
    run(args.eigenbasis_dir, args.datasets_dir, args.out, args.workers)


if __name__ == "__main__":
    main()
