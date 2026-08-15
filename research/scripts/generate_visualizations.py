"""
generate_visualizations.py — Three-panel brain surface comparison figure.

Produces a single PNG with three side-by-side panels:
  Panel 1 — OLS (no regularization)
  Panel 2 — Laplacian GLM  K=1000  λ=2.66  (matches the deployed AWS Lambda simulation)
  Panel 3 — Laplacian GLM  K=<max>  λ=2.66  (best local result; not deployable)

View and colormap match the online simulation (hemi='both', RdBu_r).

Usage:
    python aws/scripts/generate_visualizations.py \\
        --eigenbasis-dir ./local_data \\
        --dataset-dir    ./local_data_multi/localizer \\
        --contrast       "(left - right) button press" \\
        --out            activation_comparison.png

    # list available contrasts:
    python aws/scripts/generate_visualizations.py \\
        --eigenbasis-dir ./local_data \\
        --dataset-dir    ./local_data_multi/localizer \\
        --list-contrasts
"""
import argparse
import io
import sys
import time
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from scipy import sparse
from scipy.stats import norm

LAM          = 2.66
P_VAL        = 6.45e-5          # matches lambda handler default
CLUSTER_SIZE = 19
THRESHOLD    = float(norm.isf(P_VAL))   # z ≈ 4.42
K_DEPLOY     = 1000
NH           = 10_242


def _add_scripts_to_path():
    scripts = str(Path(__file__).parent)
    if scripts not in sys.path:
        sys.path.insert(0, scripts)


def _load_core():
    _add_scripts_to_path()
    from core_glm import fit_ols, fit_regularized, contrast_zscore, _sig_mask
    return fit_ols, fit_regularized, contrast_zscore, _sig_mask


def _render_panel(poly, bg, z_raw, n_left, hemi, vmax, threshold):
    """Render nilearn surface map to a numpy array (no title — added by build_figure).
    Raw z passed to nilearn threshold, matching the lambda handler exactly."""
    from nilearn.surface import SurfaceImage
    from nilearn.plotting import plot_surf_stat_map

    z = np.nan_to_num(z_raw, nan=0.0).astype(np.float32)
    stat_img = SurfaceImage(mesh=poly, data={"left": z[:n_left], "right": z[n_left:]})

    fig = plot_surf_stat_map(
        surf_mesh=poly,
        stat_map=stat_img,
        bg_map=bg,
        hemi=hemi,
        cmap='RdBu_r',
        vmax=vmax,
        threshold=threshold,
        colorbar=True,
    )

    # Post-process axes directly — more reliable than rcParams for nilearn figures
    for ax in fig.axes:
        if ax.get_label() == '<colorbar>':
            ax.tick_params(labelsize=26)
            ax.yaxis.label.set_fontsize(26)
        else:
            # 3D brain axes — enlarge any title nilearn may have set
            try:
                ax.title.set_fontsize(26)
            except AttributeError:
                pass

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    from PIL import Image as PILImage
    buf.seek(0)
    pil = PILImage.open(buf)
    pil.load()
    return np.array(pil)


def _build_poly(mesh):
    from nilearn.surface import InMemoryMesh, SurfaceImage, PolyMesh
    poly = PolyMesh(
        left=InMemoryMesh(mesh["left_coords"].astype(np.float32),
                          mesh["left_faces"].astype(np.int32)),
        right=InMemoryMesh(mesh["right_coords"].astype(np.float32),
                           mesh["right_faces"].astype(np.int32)),
    )
    bg = SurfaceImage(mesh=poly, data={"left":  mesh["sulc_left"].astype(np.float32),
                                       "right": mesh["sulc_right"].astype(np.float32)})
    return poly, bg


def _load_mesh(eigenbasis_dir):
    """Load the mesh from the eigenbasis dir (inflated surface + sulcal depth)."""
    eb = Path(eigenbasis_dir)
    return dict(
        left_coords  = np.load(eb / 'inflated_left_coords.npy'),
        left_faces   = np.load(eb / 'inflated_left_faces.npy'),
        right_coords = np.load(eb / 'inflated_right_coords.npy'),
        right_faces  = np.load(eb / 'inflated_right_faces.npy'),
        sulc_left    = np.load(eb / 'sulc_left.npy'),
        sulc_right   = np.load(eb / 'sulc_right.npy'),
    )


def build_figure(panels, out_path):
    """
    panels — list of dicts: {label, img (numpy array)}
    Composes panels side by side in a single matplotlib figure, guaranteeing
    horizontal layout regardless of individual panel aspect ratio.
    """
    n   = len(panels)
    imgs = [p['img'] for p in panels]

    # Use each panel's actual pixel aspect to set a sensible figsize
    h_px = max(a.shape[0] for a in imgs)
    w_px = max(a.shape[1] for a in imgs)
    panel_w_in = w_px / 150        # 150 dpi → inches
    panel_h_in = h_px / 150

    fig, axes = plt.subplots(
        1, n,
        figsize=(panel_w_in * n + 0.6 * (n - 1), panel_h_in + 1.4),
        facecolor='#111827',
    )
    fig.subplots_adjust(left=0.01, right=0.99, top=0.82, bottom=0.01, wspace=0.06)

    for ax, img, p in zip(axes, imgs, panels):
        ax.imshow(img)
        ax.axis('off')
        ax.set_title(
            p['label'],
            fontsize=24, fontweight='bold',
            color='white', pad=14, linespacing=1.4,
        )

    fig.savefig(str(out_path), dpi=150, bbox_inches='tight', facecolor='#111827')
    plt.close(fig)
    print(f'Saved → {out_path}')



def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--eigenbasis-dir', required=True)
    parser.add_argument('--dataset-dir', required=True)
    parser.add_argument('--contrast', default='(left - right) button press')
    parser.add_argument('--list-contrasts', action='store_true')
    parser.add_argument('--vmax', type=float, default=None,
                        help='Colorbar max (default: auto from data)')
    parser.add_argument('--out', default='activation_comparison.png')
    args = parser.parse_args()

    ds = Path(args.dataset_dir)
    eb = Path(args.eigenbasis_dir)

    print(f'Loading dataset from {ds}…')
    X = np.load(ds / 'X.npy')
    Y = np.load(ds / 'Y.npy')
    cz = np.load(ds / 'contrasts.npz')
    contrasts = {k: cz[k].astype(float) for k in cz.files}

    if args.list_contrasts:
        print('Available contrasts:')
        for name, vec in contrasts.items():
            print(f'  {name!r}  (shape {vec.shape})')
        return

    if args.contrast not in contrasts:
        sys.exit(f'Contrast {args.contrast!r} not found. Available: {list(contrasts.keys())}')
    c = contrasts[args.contrast]
    print(f'Contrast: {args.contrast!r}  |  X {X.shape}  Y {Y.shape}')

    print(f'\nLoading eigenbasis from {eb}…')
    evals_full = np.load(eb / 'evals.npy')
    evecs_full = np.load(eb / 'evecs.npy', mmap_mode='r')
    L          = sparse.load_npz(eb / 'L.npz').tocsr()
    k_max      = int(evals_full.shape[0])
    print(f'Eigenbasis: {k_max} modes')

    fit_ols, fit_regularized, contrast_zscore, _sig_mask = _load_core()

    def run_model(B, label):
        z_raw = contrast_zscore(X, Y, B, c)
        sig   = _sig_mask(z_raw, THRESHOLD, two_sided=True, cluster_size=CLUSTER_SIZE, L=L)
        z_masked = z_raw.copy()
        z_masked[~sig] = 0.0
        print(f'  {label}: {int(sig.sum()):,} significant vertices')
        return z_raw, z_masked

    # ── 1. OLS ────────────────────────────────────────────────────────────────
    print('\n[1/3] Fitting OLS…')
    t0 = time.time()
    B_ols = fit_ols(X, Y)
    print(f'      done in {time.time()-t0:.1f}s')
    z_ols_raw, z_ols = run_model(B_ols, 'OLS')

    # ── 2. Regularized K=1000 ─────────────────────────────────────────────────
    k1 = min(K_DEPLOY, k_max)
    print(f'\n[2/3] Fitting regularized  K={k1}  λ={LAM}…')
    t0 = time.time()
    B_reg1 = fit_regularized(X, Y, np.array(evals_full[:k1]), np.array(evecs_full[:, :k1]), LAM, B_ols)
    print(f'      done in {time.time()-t0:.1f}s')
    z_reg1_raw, z_reg1 = run_model(B_reg1, f'K={k1}')

    # ── 3. Regularized K=max ──────────────────────────────────────────────────
    print(f'\n[3/3] Fitting regularized  K={k_max}  λ={LAM}…')
    t0 = time.time()
    B_regmax = fit_regularized(X, Y, np.array(evals_full), np.array(evecs_full), LAM, B_ols)
    print(f'      done in {time.time()-t0:.1f}s')
    z_regmax_raw, z_regmax = run_model(B_regmax, f'K={k_max}')

    # ── vmax from raw z-scores (before masking) ───────────────────────────────
    vmax = args.vmax
    if vmax is None:
        all_raw = np.concatenate([z_ols_raw, z_reg1_raw, z_regmax_raw])
        vmax = float(min(np.nanmax(np.abs(all_raw)), 8.0))
        vmax = max(vmax, THRESHOLD + 0.5)
    print(f'\nColorbar vmax = {vmax:.2f}')

    # ── load mesh and render ─────────────────────────────────────────────────
    print('\nLoading mesh…')
    mesh = _load_mesh(str(eb))
    poly, bg = _build_poly(mesh)

    # button press uses hemi='both' in the simulation
    hemi = 'both'

    print('Rendering panels…')
    panels = [
        {'label': 'OLS\n(baseline)',
         'img': _render_panel(poly, bg, z_ols_raw,    NH, hemi, vmax, THRESHOLD)},
        {'label': f'Laplacian GLM  K={k1:,}\n(deployed — AWS Lambda)',
         'img': _render_panel(poly, bg, z_reg1_raw,   NH, hemi, vmax, THRESHOLD)},
        {'label': f'Laplacian GLM  K={k_max:,}\n(local best)',
         'img': _render_panel(poly, bg, z_regmax_raw, NH, hemi, vmax, THRESHOLD)},
    ]

    build_figure(panels, Path(args.out))
    print('Done.')


if __name__ == '__main__':
    main()
