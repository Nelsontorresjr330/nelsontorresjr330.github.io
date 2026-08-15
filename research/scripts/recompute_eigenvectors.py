"""
recompute_eigenvectors.py — Fast Laplacian eigenvector recomputation.

Optimizations
─────────────
1. Block-diagonal split — L is disconnected (left / right hemisphere), so each
   hemisphere (10,242 vertices) is solved independently. Two smaller problems
   are much faster than one large one.
2. Parallel execution — both hemispheres are decomposed simultaneously via
   ProcessPoolExecutor, fully utilizing available CPU cores.
3. Solver selection — eigsh (sparse Lanczos) is fastest when K is small.
   Once K exceeds ~30% of the hemisphere size (~3,000), LAPACK's dense eigh
   is faster because it calls optimised OpenBLAS/MKL routines that use all
   cores automatically. The script picks the faster solver automatically.

Memory guide (per hemisphere, float64)
───────────────────────────────────────
    K =  1,000 → ~80 MB eigenvectors
    K =  5,000 → ~400 MB eigenvectors
    K = 10,000 → ~800 MB eigenvectors  (dense eigh stores the full 10k×10k matrix = ~840 MB extra)
    K = 10,241 → full hemisphere spectrum; ~840 MB matrix + ~800 MB eigenvectors

Both hemispheres run in parallel, so peak RAM ≈ 2× the per-hemisphere figure.

Usage
─────
    # default: K=10,000 total (5,000 per hemisphere)
    python aws/scripts/recompute_eigenvectors.py --data-dir ./local_data

    # full spectrum (20,482 non-trivial modes)
    python aws/scripts/recompute_eigenvectors.py --data-dir ./local_data --k 20482

    # specific K
    python aws/scripts/recompute_eigenvectors.py --data-dir ./local_data --k 8000
"""

import argparse
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from scipy import sparse
from scipy.sparse.csgraph import connected_components

FSAVERAGE5_N     = 20_484
FSAVERAGE5_MAX_K = FSAVERAGE5_N - 2   # two zero modes (one per hemisphere)
DEFAULT_K        = 10_000
DENSE_THRESHOLD  = 0.30                # use dense eigh when K > 30% of hemisphere N


def _decompose_block(args):
    """Worker: decompose one hemisphere block. Runs in a subprocess."""
    sub_L_data, indices, indptr, shape, k, label = args
    import numpy as np
    from scipy import sparse
    import time

    sub_L = sparse.csr_matrix((sub_L_data, indices, indptr), shape=shape)
    N = shape[0]
    k = min(k, N - 1)   # eigsh requires k < N

    t0 = time.time()
    use_dense = k > DENSE_THRESHOLD * N

    if use_dense:
        print(f"  [{label}]  K={k}/{N} — using dense eigh (all CPU cores via LAPACK) ...")
        from scipy.linalg import eigh
        L_dense = sub_L.toarray()
        if k >= N - 1:
            # full spectrum — evd is fastest, no subset needed
            evals, evecs = eigh(L_dense, driver='evd', lower=True)
            evals, evecs = evals[:k], evecs[:, :k]
        else:
            # subset — evr (DSYEVR) supports subset_by_index, evd does not
            evals, evecs = eigh(L_dense, driver='evr', lower=True,
                                subset_by_index=[0, k - 1])
    else:
        print(f"  [{label}]  K={k}/{N} — using sparse eigsh ...")
        from scipy.sparse.linalg import eigsh
        evals, evecs = eigsh(sub_L, k=k, which="SM", sigma=1e-10, tol=0)

    order = np.argsort(evals)
    evals = np.maximum(evals[order], 0.0)
    evecs = evecs[:, order]

    elapsed = time.time() - t0
    print(f"  [{label}]  done in {elapsed:.1f}s  (λ_max={evals[-1]:.4f})")
    return evals, evecs


def recompute(data_dir, k_total):
    d = Path(data_dir)
    print("Loading L.npz ...")
    L = sparse.load_npz(d / "L.npz").tocsr()
    N = L.shape[0]

    # ── identify hemisphere blocks ───────────────────────────────────────────
    n_components, labels = connected_components(L, directed=False)
    if n_components != 2:
        print(f"  ⚠  Expected 2 components (hemispheres), found {n_components}.")
        print(f"     Falling back to single-block computation.")
        _fallback_single(L, N, k_total, d)
        return

    comp_sizes = [(labels == c).sum() for c in range(n_components)]
    print(f"Mesh: {N} vertices | components: {comp_sizes[0]} + {comp_sizes[1]} vertices")

    max_k = N - n_components
    if k_total > max_k:
        print(f"  ⚠  K={k_total} exceeds max non-trivial modes ({max_k}). Capping.")
        k_total = max_k

    # allocate K proportionally to hemisphere size
    k0 = round(k_total * comp_sizes[0] / N)
    k1 = k_total - k0
    k0 = min(k0, comp_sizes[0] - 1)
    k1 = min(k1, comp_sizes[1] - 1)

    print(f"Target K={k_total} total  →  hemisphere 0: K={k0}, hemisphere 1: K={k1}")
    print(f"Solver threshold: dense eigh when K > {DENSE_THRESHOLD*100:.0f}% of hemisphere N\n")

    # ── extract sub-matrices ─────────────────────────────────────────────────
    blocks = []
    global_indices = []
    for c, k_c, label in [(0, k0, "LH"), (1, k1, "RH")]:
        idx = np.where(labels == c)[0]
        global_indices.append(idx)
        sub = L[idx, :][:, idx].tocsr()
        blocks.append((sub.data, sub.indices, sub.indptr,
                        sub.shape, k_c, label))

    # ── parallel decomposition ───────────────────────────────────────────────
    print("Running both hemispheres in parallel ...")
    t_total = time.time()
    with ProcessPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(_decompose_block, blocks))

    # ── embed local eigenvectors into global vertex space ────────────────────
    all_evals = []
    all_evecs = []
    for (evals_c, evecs_c), idx_c in zip(results, global_indices):
        emb = np.zeros((N, evecs_c.shape[1]), dtype=np.float64)
        emb[idx_c, :] = evecs_c
        all_evals.append(evals_c)
        all_evecs.append(emb)

    evals_combined = np.concatenate(all_evals)
    evecs_combined = np.concatenate(all_evecs, axis=1)

    # sort globally by eigenvalue
    order = np.argsort(evals_combined)
    evals_out = evals_combined[order]
    evecs_out = evecs_combined[:, order]

    elapsed = time.time() - t_total
    print(f"\nTotal time: {elapsed:.1f}s")
    print(f"Output shape: evals={evals_out.shape}  evecs={evecs_out.shape}")
    print(f"Eigenvalue range: {evals_out[0]:.6f} → {evals_out[-1]:.4f}")
    print(f"Near-zero modes: {np.sum(evals_out < 1e-8)}")

    _save(d, evals_out, evecs_out)


def _fallback_single(L, N, k, d):
    """Single-block fallback for non-standard meshes."""
    from scipy.sparse.linalg import eigsh
    from scipy.linalg import eigh
    k = min(k, N - 2)
    use_dense = k > DENSE_THRESHOLD * N
    print(f"Single block, K={k}, {'dense eigh' if use_dense else 'sparse eigsh'} ...")
    t0 = time.time()
    if use_dense:
        L_dense = L.toarray()
        if k >= N - 1:
            evals, evecs = eigh(L_dense, driver='evd', lower=True)
            evals, evecs = evals[:k], evecs[:, :k]
        else:
            evals, evecs = eigh(L_dense, driver='evr', lower=True,
                                subset_by_index=[0, k - 1])
    else:
        evals, evecs = eigsh(L, k=k, which="SM", sigma=1e-10, tol=0)
    order = np.argsort(evals)
    evals = np.maximum(evals[order], 0.0)
    evecs = evecs[:, order]
    print(f"Done in {time.time()-t0:.1f}s")
    _save(d, evals, evecs)


def _save(d, evals, evecs):
    for name, arr in [("evals.npy", evals), ("evecs.npy", evecs)]:
        p = d / name
        if p.exists():
            old_k = np.load(p).shape[0] if "evals" in name else np.load(p).shape[1]
            bak = d / f"{name}.bak_k{old_k}"
            p.rename(bak)
            print(f"Backed up {name} → {bak.name}")
    np.save(d / "evals.npy", evals)
    np.save(d / "evecs.npy", evecs)
    print(f"Saved evals.npy and evecs.npy to {d.resolve()}")
    print(f"\nYou can now run k_sensitivity.py up to K={evals.shape[0]}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", required=True, metavar="DIR")
    parser.add_argument("--k", type=int, default=DEFAULT_K,
                        help=f"Total eigenvectors to compute (default: {DEFAULT_K}, max: {FSAVERAGE5_MAX_K})")
    args = parser.parse_args()
    recompute(args.data_dir, args.k)


if __name__ == "__main__":
    main()
