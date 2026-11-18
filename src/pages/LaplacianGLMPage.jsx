import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { postWithRetry } from '../lib/postWithRetry';
import { DEFAULT_PARAMS, K_SWEEP, METRICS, SAVED_IMAGES, SAVED_RESULTS } from '../content/laplacian';

const API_BASE = (import.meta.env.REACT_APP_GLM_API_URL || '').replace(/\/$/, '');
const POLL_MS = 3000;

export const pct = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
const L0 = Math.log10(20);
const L1 = Math.log10(20482);
const kx = (k) => 48 + ((Math.log10(k) - L0) / (L1 - L0)) * 572;
const ky = (v) => 180 - (v / 50) * 160;
const K_LINE = K_SWEEP.map(([k, v], i) => `${i ? 'L' : 'M'}${kx(k).toFixed(1)} ${ky(v).toFixed(1)}`).join('');
const K_DEFAULT = K_SWEEP.findIndex(([k]) => k === 1000);

/** Every (dataset, contrast) pair in a results object, in display order. */
export function figuresOf(results, images) {
  return Object.entries(results.datasets).flatMap(([ds, data]) =>
    Object.entries(data.contrasts).map(([name, stats]) => ({ ds, dsLabel: data.label, name, stats, img: images?.[ds]?.[name] })));
}

function Caption({ n, children }) {
  return <figcaption className="mt-2.5 text-[13px] leading-relaxed text-muted"><span className="font-semibold text-body">{n}</span> {children}</figcaption>;
}

export default function LaplacianGLMPage() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [results, setResults] = useState(SAVED_RESULTS);
  const [images, setImages] = useState(SAVED_IMAGES);
  const [isSaved, setIsSaved] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [figKey, setFigKey] = useState('spm_auditory/listening');
  const [kIdx, setKIdx] = useState(K_DEFAULT);
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);
  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }));

  const figures = useMemo(() => figuresOf(results, images), [results, images]);
  const fig = figures.find((f) => `${f.ds}/${f.name}` === figKey) || figures[0];
  const datasets = Object.entries(results.datasets);

  const startPolling = (jobId) => {
    setStatus('Computing metrics and rendering brain surfaces across 3 datasets…');
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/status/${jobId}`);
        const data = await res.json();
        if (data.ready) {
          clearInterval(pollRef.current);
          setResults(data.results);
          setImages(data.images || {});
          setIsSaved(false);
          setLoading(false);
          setStatus('');
        }
      } catch (_) { /* keep polling */ }
    }, POLL_MS);
  };

  const handleRun = async () => {
    if (!API_BASE) { setError('The demo API is not configured on this build.'); return; }
    const pv = parseFloat(params.pVal);
    if (Number.isNaN(pv) || pv <= 0 || pv >= 1) { setError('Enter a p-value between 0 and 1, such as 0.001 or 6.45e-5.'); return; }
    clearInterval(pollRef.current);
    setLoading(true); setError(null);
    try {
      // Retries once on a 5xx: the Lambda can fail its first request after a cold start.
      const res = await postWithRetry(`${API_BASE}/run`, {
        lambda: params.lambda,
        n_eigenvectors: params.nEigenvectors,
        p_val: pv,
        cluster_threshold: params.clusterThreshold,
        two_sided: true,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
      if (!data.jobId) throw new Error('No job ID returned');
      startPolling(data.jobId);
    } catch (e) {
      setError(e.message); setLoading(false);
    }
  };

  const sel = results.selected || {};
  const kp = K_SWEEP[kIdx];

  return (
    <article className="mx-auto max-w-[840px] px-6 pt-14 pb-24">
      <p className="m-0 flex items-center gap-2 font-mono text-[11px] tracking-[0.1em]">
        <span className="text-aca-soft">RESEARCH</span>
        <span className="rounded-full bg-raised px-2 py-0.5 tracking-normal text-emerald-300">Live</span>
      </p>
      <h1 className="mt-3.5 mb-0 text-[38px] leading-tight font-bold tracking-[-0.03em] text-ink">
        Cortical Surface Informed Laplacian-Regularized GLM for First-Level fMRI Estimation
      </h1>
      <p className="mt-3.5 mb-0 text-[15px] text-muted">Nelson Torres · Advisor: Dr. Xin Yang · Middle Tennessee State University · 2026</p>

      <div className="mt-7 rounded-[14px] border border-[#1c2a33] bg-[#0b1218] px-5.5 py-5">
        <p className="m-0 font-mono text-[11px] tracking-[0.1em] text-aca-soft">ABSTRACT</p>
        <p className="mt-2 mb-0 text-base leading-[1.7] text-soft">
          Standard first-level analysis estimates each cortical vertex independently. Adding a graph Laplacian penalty from the cortical mesh lets neighboring vertices share information; the problem has a closed-form solution on the mesh’s eigenbasis. Across three task-fMRI datasets and four metrics, the estimator improves on OLS by 20.85% at K = 1,000 and by 50.0% with the full eigenbasis.
        </p>
      </div>

      <h2 className="mt-12 mb-0 text-[22px] font-bold text-ink">Method</h2>
      <p className="mt-2.5 mb-0 text-base leading-[1.7] text-muted">For BOLD data Y, design X and the cortical-mesh Laplacian L, the estimator solves</p>
      <p className="my-4 rounded-[10px] border border-line-strong bg-panel p-3.5 text-center font-mono text-[17px] text-sky-100">
        min<sub>B</sub> ‖Y − XB‖²<sub>F</sub> + λ · tr(B L Bᵀ)
      </p>
      <p className="m-0 text-base leading-[1.7] text-muted">Projecting onto the K smoothest Laplacian eigenvectors diagonalizes the penalty, so each mode is shrunk by 1 / (1 + λμ<sub>k</sub>), with no iterative solver.</p>

      <h2 className="mt-12 mb-0 text-[22px] font-bold text-ink">Try It</h2>
      <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] items-end gap-x-5 gap-y-3.5 rounded-[14px] border border-line-strong bg-panel p-4.5">
        <label className="flex flex-col gap-1 text-[13px] text-soft">
          <span>λ = <span className="font-mono text-aca-soft">{params.lambda}</span></span>
          <input type="range" min="0" max="10" step="0.01" value={params.lambda} onChange={(e) => set('lambda', Number(e.target.value))} className="h-[26px] w-full" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-soft">
          <span>K = <span className="font-mono text-aca-soft">{params.nEigenvectors}</span></span>
          <input type="range" min="50" max="1000" step="50" value={params.nEigenvectors} onChange={(e) => set('nEigenvectors', Number(e.target.value))} className="h-[26px] w-full" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-soft">
          p-value
          <input type="text" value={params.pVal} onChange={(e) => set('pVal', e.target.value)} className="min-h-[38px] rounded-lg border border-solid border-[#27272e] bg-ground px-2.5 font-mono text-[13px] text-ink outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-soft">
          Cluster (vertices)
          <input type="number" min="1" max="5000" value={params.clusterThreshold} onChange={(e) => set('clusterThreshold', Number(e.target.value))} className="min-h-[38px] rounded-lg border border-solid border-[#27272e] bg-ground px-2.5 font-mono text-[13px] text-ink outline-none" />
        </label>
        <button type="button" onClick={handleRun} disabled={loading} className="min-h-[42px] rounded-[10px] border-0 text-sm font-semibold text-sky-950 disabled:cursor-not-allowed" style={{ background: loading ? '#3f3f46' : '#7dd3fc' }}>
          {loading ? 'Running…' : 'Run on AWS Lambda'}
        </button>
        <p className="col-span-full m-0 text-[13px] text-muted" aria-live="polite">
          {loading ? (status || 'Starting on AWS Lambda…') : isSaved ? 'Defaults are the search-optimal settings; results below are from that run. A new run takes about 1–2 minutes.' : 'Results below are from your run.'}
        </p>
        {error && <p role="alert" className="col-span-full m-0 rounded-[10px] bg-[#2a1208] px-3 py-2.5 text-[13px] text-per-soft">{error}</p>}
      </div>

      <h2 className="mt-12 mb-0 text-[22px] font-bold text-ink">Results</h2>
      <p className="mt-2.5 mb-0 text-base leading-[1.7] text-muted">
        Overall improvement over OLS: <span className="font-semibold text-aca-soft">{pct(results.combined)}</span> (mean of {datasets.length} datasets at λ = {sel.lambda}, K = {Number(sel.n_eigenvectors).toLocaleString()}).
      </p>

      <figure className="mt-6 mb-0">
        <div role="tablist" aria-label="Contrast" className="mb-3 flex flex-wrap gap-1.5">
          {figures.map((f) => {
            const key = `${f.ds}/${f.name}`;
            const on = key === `${fig.ds}/${fig.name}`;
            return (
              <button key={key} type="button" role="tab" aria-selected={on} onClick={() => setFigKey(key)}
                className="min-h-[34px] rounded-full border border-solid px-3 font-mono text-xs"
                style={{ borderColor: on ? '#38bdf8' : '#27272e', background: on ? '#0c1a24' : 'transparent', color: on ? '#e0f2fe' : 'var(--color-muted)' }}>
                {f.dsLabel} · {f.name}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-start gap-5">
          {fig.img
            ? <img src={fig.img} alt={`${fig.name}: OLS above, regularized below`} className="max-w-[420px] min-w-0 flex-[1_1_300px] rounded-xl bg-white p-2.5" />
            : <div className="flex h-60 max-w-[420px] min-w-0 flex-[1_1_300px] items-center justify-center rounded-xl border border-line-strong text-sm text-muted">Rendering…</div>}
          <table className="flex-[1_1_260px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted"><th className="border-b border-line-strong py-2 font-medium" /><th className="border-b border-line-strong py-2 font-medium">OLS</th><th className="border-b border-line-strong py-2 font-medium">Regularized</th></tr>
            </thead>
            <tbody className="font-mono text-body">
              <tr><td className="border-b border-raised py-2 font-sans text-muted">Significant (+)</td><td className="border-b border-raised">{fig.stats.ols.sig_positive}</td><td className="border-b border-raised">{fig.stats.reg.sig_positive}</td></tr>
              <tr><td className="border-b border-raised py-2 font-sans text-muted">Significant (−)</td><td className="border-b border-raised">{fig.stats.ols.sig_negative}</td><td className="border-b border-raised">{fig.stats.reg.sig_negative}</td></tr>
              <tr><td className="py-2 font-sans text-muted">Peak |z|</td><td>{fig.stats.ols.peak_z.toFixed(2)}</td><td>{fig.stats.reg.peak_z.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
        <Caption n="Figure 1.">{fig.dsLabel}, {fig.name}. Top: OLS. Bottom: regularized, λ = {sel.lambda}.</Caption>
      </figure>

      <figure className="mt-9 mb-0">
        <div className="overflow-x-auto rounded-xl border border-line-strong bg-panel">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="border-b border-line-strong px-3.5 py-2.5 font-medium">Metric</th>
                {datasets.map(([ds, d]) => <th key={ds} className="border-b border-line-strong px-3.5 py-2.5 font-medium">{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...METRICS.map(([key, label]) => ({ label, values: datasets.map(([, d]) => d.dims[key]) })), { label: 'Combined', values: datasets.map(([, d]) => d.score), strong: true }].map((row) => (
                <tr key={row.label}>
                  <td className="border-b border-raised px-3.5 py-2.5 text-ink" style={{ fontWeight: row.strong ? 600 : 400 }}>{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="border-b border-raised px-3.5 py-2.5 font-mono" style={{ color: v >= 0 ? '#7dd3fc' : '#fdba74', fontWeight: row.strong ? 600 : 400 }}>{pct(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Caption n="Table 1.">Improvement over OLS. {METRICS.map(([, l, d]) => `${l}: ${d.charAt(0).toLowerCase()}${d.slice(1)}`).join('. ')}.</Caption>
      </figure>

      <figure className="mt-9 mb-0">
        <svg viewBox="0 0 640 220" role="img" aria-label="Combined improvement versus eigenvectors K" className="block h-auto w-full rounded-xl border border-line-strong bg-panel">
          <path d="M48 180H620M48 20V180" stroke="#2a2a31" fill="none" />
          <path d="M48 100H620" stroke="#16161b" fill="none" />
          <text x="40" y="184" fontSize="10" fill="#a1a1aa" textAnchor="end">0%</text>
          <text x="40" y="104" fontSize="10" fill="#a1a1aa" textAnchor="end">25%</text>
          <text x="40" y="24" fontSize="10" fill="#a1a1aa" textAnchor="end">50%</text>
          <path d={`M${kx(1000).toFixed(1)} 20V180`} stroke="#52525b" strokeDasharray="3 4" fill="none" />
          <path d={K_LINE} stroke="#38bdf8" strokeWidth="2" fill="none" />
          <circle cx={kx(kp[0])} cy={ky(kp[1])} r="5" fill="#08080a" stroke="#e0f2fe" strokeWidth="2" />
          <text x="334" y="208" fontSize="10" fill="#a1a1aa" textAnchor="middle">eigenvectors K, log scale (20 → 20,482)</text>
        </svg>
        <input type="range" min="0" max={K_SWEEP.length - 1} value={kIdx} onChange={(e) => setKIdx(Number(e.target.value))} aria-label="Eigenvectors K" className="mt-2 h-[26px] w-full" />
        <Caption n="Figure 2.">Combined improvement as K grows: at K = {kp[0].toLocaleString()}, <span className="font-semibold text-aca-soft">+{kp[1].toFixed(2)}%</span>. Dashed line: the web demo’s K = 1,000 limit.</Caption>
      </figure>

      <figure className="mt-9 mb-0">
        <img src="/research/laplacian-glm/activation-comparison.png" alt="Activation maps: OLS, K = 1,000 and K = 20,482" className="box-border block w-full rounded-xl bg-white p-3" />
        <Caption n="Figure 3.">Activation maps: OLS, K = 1,000 and the full eigenbasis (K = 20,482).</Caption>
      </figure>

      <p className="mt-12 mb-0 border-t border-line pt-5 text-sm text-muted">
        Data: nilearn’s Localizer, SPM Auditory and SPM Multimodal datasets. <Link to="/academic" className="text-aca-soft no-underline">Back to Academic</Link>
      </p>
    </article>
  );
}
