"""
prep_multi.py — Prepare multiple nilearn task-fMRI datasets for the
multi-dataset generalization test.

Each dataset is projected onto the SAME fsaverage5 surface (so it shares the
Laplacian eigenbasis already stored in --eigenbasis-dir), then its design
matrix X, surface BOLD Y (full 20484 vertices), and a set of per-regressor
contrasts are cached under <out-dir>/<name>/.

Only datasets whose preprocessed EPI is MNI-aligned with fsaverage5 project
cleanly (verified by the finite-fraction check). localizer, spm_auditory and
spm_multimodal pass; FIAC does not (its volume does not overlap the mesh).

Usage:
    python aws/scripts/prep_multi.py --out-dir ./local_data_multi
"""
import argparse
import warnings
warnings.filterwarnings("ignore")
import time
from pathlib import Path

import numpy as np
import pandas as pd
import nibabel as nib
from nilearn.datasets import (fetch_localizer_first_level, fetch_spm_auditory,
                              fetch_spm_multimodal_fmri, load_fsaverage)
from nilearn.glm.first_level import FirstLevelModel
from nilearn.surface import SurfaceImage
from nilearn.surface.surface import get_data as surf_data

FS = load_fsaverage()  # fsaverage5


def _contrasts_from_design(cols):
    """One contrast per main task regressor (skip drift / constant / motion / derivative)."""
    eye = np.eye(len(cols))
    out = {}
    for i, col in enumerate(cols):
        c = col.lower()
        if ("drift" in c or "constant" in c or "derivative" in c
                or c.startswith("trans") or c.startswith("rot")):
            continue
        out[col] = eye[i].astype(np.float64)
    return out


def _prep(vol_img, t_r, events=None, design=None, slice_time_ref=0.0):
    surf = SurfaceImage.from_volume(mesh=FS["pial"], volume_img=vol_img)
    Y = surf_data(surf).T.astype(np.float64)         # (T, 20484) — full surface
    if design is None:
        glm = FirstLevelModel(t_r=t_r, slice_time_ref=slice_time_ref,
                              hrf_model="glover + derivative", drift_model="cosine",
                              high_pass=1 / 128, minimize_memory=False).fit(run_imgs=surf, events=events)
        Xdf = glm.design_matrices_[0]
        cols = list(Xdf.columns); X = Xdf.values.astype(np.float64)
    else:
        X = design.values.astype(np.float64); cols = list(design.columns)
    return X, np.nan_to_num(Y), _contrasts_from_design(cols)


def _events(obj):
    return pd.read_csv(obj, sep="\t") if isinstance(obj, str) else obj


def build_localizer():
    a = fetch_localizer_first_level()
    return _prep(a.epi_img, a.t_r, events=_events(a.events), slice_time_ref=a.slice_time_ref)


def build_spm_auditory():
    b = fetch_spm_auditory()
    vol = b.func[0] if isinstance(b.func, (list, tuple)) else b.func
    return _prep(vol, b.t_r, events=_events(b.events))


def build_spm_multimodal():
    m = fetch_spm_multimodal_fmri()
    # 390 single volumes with tiny per-volume affine noise; same grid, so stack
    # directly onto the first volume's affine (exact — no resampling/interpolation).
    imgs = [nib.load(p) if isinstance(p, str) else p for p in m.func1]
    ref_affine = imgs[0].affine
    arrs = [np.asarray(im.dataobj).reshape(im.shape[:3]) for im in imgs]
    vol = nib.Nifti1Image(np.stack(arrs, axis=-1), ref_affine)
    ev = _events(m.events1)
    return _prep(vol, m.t_r, events=ev)


BUILDERS = {
    "localizer":     build_localizer,
    "spm_auditory":  build_spm_auditory,
    "spm_multimodal": build_spm_multimodal,
}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out-dir", default="./local_data_multi")
    args = ap.parse_args()
    out = Path(args.out_dir); out.mkdir(parents=True, exist_ok=True)

    print(f"{'dataset':16} {'T':>4} {'N':>7} {'#con':>5} {'finite%':>8}")
    print("-" * 46)
    for name, builder in BUILDERS.items():
        t0 = time.time()
        X, Y, con = builder()
        finite = 100.0 * np.mean(Y != 0.0)           # rough coverage indicator
        d = out / name; d.mkdir(exist_ok=True)
        np.save(d / "X.npy", X)
        np.save(d / "Y.npy", Y)
        np.savez(d / "contrasts.npz", **con)
        print(f"{name:16} {X.shape[0]:>4} {Y.shape[1]:>7} {len(con):>5} {finite:>7.1f}%   ({time.time()-t0:.0f}s)")

    print(f"\nSaved {len(BUILDERS)} datasets to {out.resolve()}")
    print("Shared eigenbasis (evals/evecs/L) is reused from the single-dataset local_data dir.")


if __name__ == "__main__":
    main()
