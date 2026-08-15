"""
One-time data preparation script.

Runs pipeline steps 1-6 from LaplacianPenalty.py (data load, surface projection,
GLM fit, Laplacian build, eigenbasis computation), serialises the results, and
uploads them to S3.  The Lambda function then loads these arrays on cold start
without needing nilearn.

Usage (from repo root):
    python aws/scripts/prep_data.py --bucket laplacian-glm-data --region us-east-1

Requirements: the same Python environment as LaplacianPenalty.py (nilearn, scipy, etc.)
Estimated runtime: 5-15 minutes depending on machine (eigenbasis is the slow step).
"""

import argparse
import io
import time

import boto3
import numpy as np
from scipy import sparse
from scipy.linalg import eigh as dense_eigh
from scipy.sparse.linalg import eigsh
from scipy.stats import norm as scipy_norm

from nilearn.datasets import fetch_localizer_first_level, load_fsaverage, load_fsaverage_data
from nilearn.glm.first_level import FirstLevelModel
from nilearn.surface import SurfaceImage
from nilearn.surface.surface import get_data as get_surf_data  # still used for sulc_arr

# Match defaults from LaplacianPenalty.py
HRF_MODEL        = "glover + derivative"
DRIFT_MODEL      = "cosine"
HIGH_PASS_CUTOFF = 128
# Default eigenvector count. 1000 is "web-safe": the resulting evecs.npy
# (~156 MB) loads within the API Gateway 29s limit on the 2 GB Lambda.
# Offline research runs can pass a larger --n-eigenvectors (e.g. 10000),
# but the live web backend cannot serve counts that produce a >~200 MB
# evecs file (cold-start load exceeds the API Gateway timeout).
N_EIGENVECTORS   = 1000


def _build_laplacian(mesh_part):
    coords = np.asarray(mesh_part.coordinates)
    faces  = np.asarray(mesh_part.faces)
    n_v    = coords.shape[0]
    edge_i = np.concatenate([faces[:, 0], faces[:, 1],
                              faces[:, 1], faces[:, 2],
                              faces[:, 0], faces[:, 2]])
    edge_j = np.concatenate([faces[:, 1], faces[:, 0],
                              faces[:, 2], faces[:, 1],
                              faces[:, 2], faces[:, 0]])
    A       = sparse.csr_matrix((np.ones(len(edge_i)), (edge_i, edge_j)), shape=(n_v, n_v))
    A       = (A > 0).astype(float)
    degrees = np.asarray(A.sum(axis=1)).ravel()
    return sparse.diags(degrees) - A


def _upload_npy(s3, bucket, arr, key):
    buf = io.BytesIO()
    np.save(buf, arr)
    buf.seek(0)
    s3.put_object(Bucket=bucket, Key=key, Body=buf.read())
    print(f"  ✓ {key}  ({arr.nbytes / 1e6:.1f} MB)")


def _upload_npz(s3, bucket, mat, key):
    buf = io.BytesIO()
    sparse.save_npz(buf, mat)
    buf.seek(0)
    s3.put_object(Bucket=bucket, Key=key, Body=buf.read())
    print(f"  ✓ {key}  (sparse, {mat.nnz:,} nnz)")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", required=True, help="S3 bucket name (from CloudFormation output)")
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--n-eigenvectors", type=int, default=N_EIGENVECTORS,
                        help=f"Number of Laplacian eigenvectors to precompute "
                             f"(default {N_EIGENVECTORS}, web-safe). Larger values (e.g. 10000) "
                             f"are for offline research only — the live Lambda cannot load them "
                             f"within the API Gateway timeout.")
    args = parser.parse_args()

    n_eig = args.n_eigenvectors
    s3 = boto3.client("s3", region_name=args.region)

    # ------------------------------------------------------------------
    # Steps 1-2: Load data and project to surface
    # ------------------------------------------------------------------
    print("\n[1/6] Fetching localizer fMRI data...")
    data           = fetch_localizer_first_level()
    t_r            = data.t_r
    slice_time_ref = data.slice_time_ref

    print("[2/6] Projecting volume to fsaverage5 surface...")
    fsaverage5    = load_fsaverage()
    surface_image = SurfaceImage.from_volume(
        mesh=fsaverage5["pial"],
        volume_img=data.epi_img,
    )

    # ------------------------------------------------------------------
    # Step 3: Fit standard GLM to extract design matrix
    # ------------------------------------------------------------------
    print("[3/6] Fitting first-level GLM (for design matrix)...")
    glm = FirstLevelModel(
        t_r=t_r,
        slice_time_ref=slice_time_ref,
        hrf_model=HRF_MODEL,
        drift_model=DRIFT_MODEL,
        high_pass=1.0 / HIGH_PASS_CUTOFF,
        minimize_memory=False,
    ).fit(run_imgs=surface_image, events=data.events)

    design_matrix = glm.design_matrices_[0]
    X = design_matrix.values.astype(np.float64)
    T, p = X.shape
    print(f"    Design matrix: {T} timepoints × {p} regressors")

    # ------------------------------------------------------------------
    # Step 4: Extract BOLD signal Y
    # ------------------------------------------------------------------
    print("[4/6] Extracting BOLD signal...")
    Y = glm.masker_.transform(surface_image).astype(np.float64)
    print(f"    BOLD data: {Y.shape}")

    n_left  = len(np.asarray(fsaverage5["pial"].parts["left"].coordinates))
    n_right = len(np.asarray(fsaverage5["pial"].parts["right"].coordinates))
    print(f"    {n_left} left + {n_right} right vertices")

    # ------------------------------------------------------------------
    # Step 5: Build surface graph Laplacian
    # ------------------------------------------------------------------
    print("[5/6] Building surface graph Laplacians...")
    L_left  = _build_laplacian(fsaverage5["pial"].parts["left"])
    L_right = _build_laplacian(fsaverage5["pial"].parts["right"])
    L_full  = sparse.block_diag([L_left, L_right], format="csr")
    print(f"    Laplacian: {L_full.shape}, {L_full.nnz:,} non-zeros")

    # ------------------------------------------------------------------
    # Step 6: Compute truncated spectral eigenbasis
    # ------------------------------------------------------------------
    print(f"[6/6] Computing {n_eig} eigenvectors (slow step — a few minutes)...")
    t0 = time.time()
    n_v = L_full.shape[0]
    if n_eig >= 0.20 * n_v:
        # Large fraction of the spectrum: ARPACK (eigsh) is inefficient and
        # unstable here (it would build a near-full Krylov basis). A dense
        # partial solver is the correct tool — LAPACK's ?syevr computes just
        # the smallest n_eig eigenpairs directly.
        print(f"    Using dense solver (k={n_eig} is a large fraction of n={n_v}).")
        L_dense = L_full.toarray()
        evals, evecs = dense_eigh(L_dense, subset_by_index=[0, n_eig - 1])
        del L_dense
    else:
        evals, evecs = eigsh(L_full, k=n_eig, which="SM", tol=1e-6, maxiter=3000)
    order  = np.argsort(evals)
    evals  = evals[order].astype(np.float64)
    evecs  = evecs[:, order].astype(np.float64)
    print(f"    Done in {time.time()-t0:.1f}s.  λ range: [{evals[0]:.3f}, {evals[-1]:.3f}]")

    # ------------------------------------------------------------------
    # Build contrast vectors (matching LaplacianPenalty.py step 9)
    # ------------------------------------------------------------------
    eye   = np.eye(p)
    basic = {col: eye[i] for i, col in enumerate(design_matrix.columns)}

    basic["audio"] = (basic["audio_left_hand_button_press"]
                      + basic["audio_right_hand_button_press"]
                      + basic["audio_computation"]
                      + basic["sentence_listening"])
    basic["visual"] = (basic["visual_left_hand_button_press"]
                       + basic["visual_right_hand_button_press"]
                       + basic["visual_computation"]
                       + basic["sentence_reading"])
    basic["computation"] = basic["visual_computation"] + basic["audio_computation"]
    basic["sentences"]   = basic["sentence_listening"]  + basic["sentence_reading"]

    c_left_minus_right            = (basic["audio_left_hand_button_press"]
                                     - basic["audio_right_hand_button_press"]
                                     + basic["visual_left_hand_button_press"]
                                     - basic["visual_right_hand_button_press"])
    c_audio_minus_visual          = basic["audio"]       - basic["visual"]
    c_computation_minus_sentences = basic["computation"] - basic["sentences"]

    # ------------------------------------------------------------------
    # Save inflated mesh and sulcal depth for nilearn rendering in handler.py
    # ------------------------------------------------------------------
    print("Saving inflated mesh coordinates, faces, and sulcal depth...")
    fsavg     = load_fsaverage()
    inflated  = fsavg["inflated"]
    _upload_npy(s3, args.bucket,
                np.asarray(inflated.parts["left"].coordinates, dtype=np.float32),
                "data/inflated_left_coords.npy")
    _upload_npy(s3, args.bucket,
                np.asarray(inflated.parts["left"].faces, dtype=np.int32),
                "data/inflated_left_faces.npy")
    _upload_npy(s3, args.bucket,
                np.asarray(inflated.parts["right"].coordinates, dtype=np.float32),
                "data/inflated_right_coords.npy")
    _upload_npy(s3, args.bucket,
                np.asarray(inflated.parts["right"].faces, dtype=np.int32),
                "data/inflated_right_faces.npy")

    # Sulcal depth — background map for nilearn plot_surf_stat_map
    sulc_img = load_fsaverage_data(mesh='fsaverage5', data_type='sulcal')
    sulc_arr = get_surf_data(sulc_img).astype(np.float32)
    _upload_npy(s3, args.bucket, sulc_arr[:n_left],  "data/sulc_left.npy")
    _upload_npy(s3, args.bucket, sulc_arr[n_left:],  "data/sulc_right.npy")

    # ------------------------------------------------------------------
    # Upload to S3
    # ------------------------------------------------------------------
    print(f"\nUploading to s3://{args.bucket}/data/ ...")
    _upload_npy(s3, args.bucket, X,                              "data/X.npy")
    _upload_npy(s3, args.bucket, Y,                              "data/Y.npy")
    _upload_npy(s3, args.bucket, evals,                          "data/evals.npy")
    _upload_npy(s3, args.bucket, evecs,                          "data/evecs.npy")
    _upload_npy(s3, args.bucket, np.array(n_left),               "data/n_left.npy")
    _upload_npz(s3, args.bucket, L_full,                         "data/L.npz")
    _upload_npy(s3, args.bucket, c_left_minus_right,             "data/contrast_left_minus_right.npy")
    _upload_npy(s3, args.bucket, c_audio_minus_visual,           "data/contrast_audio_minus_visual.npy")
    _upload_npy(s3, args.bucket, c_computation_minus_sentences,  "data/contrast_computation_minus_sentences.npy")

    print("\nAll data uploaded successfully.")
    print(f"Bucket:        {args.bucket}")
    print(f"Design matrix: {X.shape}")
    print(f"BOLD matrix:   {Y.shape}")
    print(f"Eigenvectors:  {evecs.shape}")


if __name__ == "__main__":
    main()
