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
from scipy.sparse.linalg import eigsh

from nilearn.datasets import fetch_localizer_first_level, load_fsaverage
from nilearn.glm.first_level import FirstLevelModel
from nilearn.surface import SurfaceImage

# Match defaults from LaplacianPenalty.py
HRF_MODEL        = "glover + derivative"
DRIFT_MODEL      = "cosine"
HIGH_PASS_CUTOFF = 128
N_EIGENVECTORS   = 500


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
    args = parser.parse_args()

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
    print(f"[6/6] Computing {N_EIGENVECTORS} eigenvectors (slow step — a few minutes)...")
    t0 = time.time()
    evals, evecs = eigsh(L_full, k=N_EIGENVECTORS, which="SM", tol=1e-6, maxiter=3000)
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
