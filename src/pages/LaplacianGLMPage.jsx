import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

const API_BASE = (process.env.REACT_APP_GLM_API_URL || '').replace(/\/$/, '');

const DEFAULT_PARAMS = {
  lambda:           0.5,
  nEigenvectors:    500,
  pVal:             0.001,
  clusterThreshold: 20,
  twoSided:         true,
};

// Full candidate set for log-spaced sweep — filtered to ≤ lambda at run time
const SWEEP_CANDIDATES = [0.0, 0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0,
                          10.0, 20.0, 50.0, 100.0, 200.0, 500.0, 1000.0];

function generateSweep(lambda) {
  const maxSweep = Math.max(lambda, 10);
  const pts = SWEEP_CANDIDATES.filter(v => v === 0 || v <= maxSweep);
  if (lambda > 0 && !pts.includes(lambda)) pts.push(lambda);
  return pts.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Small reusable controls
// ---------------------------------------------------------------------------

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step, className = '' }) {
  return (
    <input
      type="number"
      value={value}
      min={min} max={max} step={step}
      onChange={e => onChange(Number(e.target.value))}
      className={`w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${className}`}
    />
  );
}

function SliderWithInput({ label, hint, value, onChange, min, max, step }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 accent-blue-500"
        />
        <NumberInput value={value} onChange={onChange} min={min} max={max} step={step} className="w-24" />
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Sweep charts — fixed: type="number" required for log scale in Recharts
// ---------------------------------------------------------------------------

const ALL_LOG_TICKS = [0.001, 0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

function formatLogTick(v) {
  if (v <= 0.001) return '0';
  return v < 1 ? v.toString() : v.toString();
}

// Compact number formatter for Y-axis ticks — prevents long numbers overlapping the axis label
function fmtYTick(v) {
  if (!isFinite(v)) return '';
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(3);
}

function SweepChart({ data, selectedLambda, dataKey, color, label }) {
  if (!data || data.length === 0) return null;
  const values = data.map(d => d[dataKey]).filter(v => v != null && isFinite(v));
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const pad  = (yMax - yMin) * 0.08 || yMax * 0.05;

  // X domain scales to fit both sweep points and the selected lambda
  const xMax   = Math.max(...data.map(d => d.lambdaPlot), selectedLambda <= 0 ? 0.001 : selectedLambda);
  const xUpper = xMax * 2.5;
  const xTicks = ALL_LOG_TICKS.filter(t => t >= 0.0009 && t <= xUpper);

  return (
    <div>
      <p className="text-sm font-medium text-gray-300 mb-2">{label}</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            type="number"
            dataKey="lambdaPlot"
            scale="log"
            domain={[0.0009, xUpper]}
            ticks={xTicks}
            tickFormatter={formatLogTick}
            label={{ value: 'λ (log scale)', position: 'insideBottom', offset: -12, fill: '#9ca3af', fontSize: 12 }}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            domain={[yMin - pad, yMax + pad]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={fmtYTick}
            width={62}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#d1d5db' }}
            formatter={(v, name) => [typeof v === 'number' ? v.toFixed(5) : v, name]}
            labelFormatter={v => `λ = ${v}`}
          />
          <Line
            type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
            dot={{ r: 4, fill: color }} name={label} isAnimationActive={false}
          />
          <ReferenceLine
            x={selectedLambda <= 0 ? 0.001 : selectedLambda}
            stroke="#ef4444" strokeDasharray="4 4"
            label={{ value: `λ=${selectedLambda}`, fill: '#ef4444', fontSize: 11, position: 'top' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evaluation panel
// ---------------------------------------------------------------------------

// Compute overall regularization benefit as a relative improvement (positive = reg better).
// Each dimension is normalised relative to OLS so they're comparable across scales.
function computeOverallScore(ev) {
  const eps = 1e-9;
  const dims = [];

  // 1. Generalization — lower MSE is better
  const { ols: mo, reg: mr } = ev.held_out_mse;
  dims.push({ label: 'Generalization', delta: (mo - mr) / (mo + eps) });

  // 2. Semi-synthetic recovery — higher correlation is better
  const ss = Object.values(ev.semi_synthetic);
  dims.push({
    label: 'Recovery',
    delta: ss.reduce((s, v) =>
      s + (v.recovery_corr_reg - v.recovery_corr_ols) / (Math.abs(v.recovery_corr_ols) + eps), 0) / ss.length,
  });

  // 3. Reproducibility — higher map correlation is better
  const rp = Object.values(ev.reproducibility);
  dims.push({
    label: 'Reproducibility',
    delta: rp.reduce((s, v) =>
      s + (v.map_corr_reg - v.map_corr_ols) / (Math.abs(v.map_corr_ols) + eps), 0) / rp.length,
  });

  // 4. HRF consistency — higher R² at significant vertices is better
  const hc = Object.values(ev.hrf_consistency)
    .filter(v => v.r2_ols_sig != null && v.r2_reg_sig != null);
  if (hc.length) {
    dims.push({
      label: 'HRF Consistency',
      delta: hc.reduce((s, v) =>
        s + (v.r2_reg_sig - v.r2_ols_sig) / (Math.abs(v.r2_ols_sig) + eps), 0) / hc.length,
    });
  }

  const overall = dims.reduce((s, d) => s + d.delta, 0) / dims.length;
  return { overall, dims };
}

// Small badge showing which parameters influence a given metric
function ParamTag({ type }) {
  return type === 'independent'
    ? <span className="text-xs px-1.5 py-0.5 rounded border bg-blue-900/30 border-blue-800 text-blue-300 ml-2">λ · K only</span>
    : <span className="text-xs px-1.5 py-0.5 rounded border bg-purple-900/30 border-purple-800 text-purple-300 ml-2">all params</span>;
}

function EvalCard({ label, value, subtext, winner }) {
  return (
    <div className={`rounded p-3 text-center ${winner ? 'bg-green-900/30 border border-green-700' : 'bg-gray-700'}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-mono font-semibold text-white">{value}</p>
      {subtext && <p className={`text-xs mt-0.5 ${winner ? 'text-green-400' : 'text-gray-500'}`}>{subtext}</p>}
    </div>
  );
}

function EvaluationPanel({ evaluation }) {
  if (!evaluation) return null;
  const { held_out_mse, semi_synthetic, reproducibility, hrf_consistency } = evaluation;
  const fmt  = v => (v == null ? '—' : v.toFixed(3));
  const pct  = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
  const score = computeOverallScore(evaluation);

  return (
    <div className="bg-gray-800 rounded-lg p-5 space-y-7">
      <div>
        <h3 className="text-lg font-semibold">Model Evaluation</h3>
        <p className="text-xs text-gray-500 mt-1">
          Four independent perspectives on whether activations reflect real brain activity.
          Badge <span className="px-1 bg-blue-900/30 border border-blue-800 text-blue-300 rounded text-xs">λ · K only</span> = unaffected by p-value or cluster threshold.
          Badge <span className="px-1 bg-purple-900/30 border border-purple-800 text-purple-300 rounded text-xs">all params</span> = changes with every parameter.
        </p>
      </div>

      {/* ── Overall score ── */}
      <div className="bg-gray-700/60 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-200">Overall Assessment</h4>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className={`text-4xl font-mono font-bold ${
              score.overall > 0.01 ? 'text-green-400' :
              score.overall < -0.01 ? 'text-orange-400' : 'text-gray-300'
            }`}>
              {pct(score.overall)}
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-[180px]">
              {score.overall > 0.01
                ? 'Regularized outperforms OLS on average across all dimensions'
                : score.overall < -0.01
                ? 'OLS outperforms Regularized on average across all dimensions'
                : 'Both methods perform comparably'}
            </p>
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            {score.dims.map(d => (
              <div key={d.label} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">{d.label}</span>
                  <span className={`font-mono ${d.delta > 0.005 ? 'text-green-400' : d.delta < -0.005 ? 'text-orange-400' : 'text-gray-400'}`}>
                    {pct(d.delta)}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${d.delta >= 0 ? 'bg-green-500' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(Math.abs(d.delta) * 300, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500 border-t border-gray-600 pt-2">
          Average relative improvement of Regularized vs OLS. Positive = Regularized wins.
          Bar length = magnitude (100% bar = 33%+ improvement).
        </p>
      </div>

      {/* ── 1 — Held-out MSE ── */}
      <div className="space-y-2">
        <div className="flex items-center">
          <h4 className="text-sm font-medium text-gray-200">1 · Generalization — Held-out MSE</h4>
          <ParamTag type="independent" />
        </div>
        <p className="text-xs text-gray-500">
          Fit on the first 80% of timepoints, predicted on the last 20%. OLS minimises
          in-sample MSE by definition — held-out MSE is the only fair comparison. Lower = better.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <EvalCard label="OLS" value={held_out_mse.ols.toFixed(1)} />
          <EvalCard
            label="Regularized"
            value={held_out_mse.reg.toFixed(1)}
            winner={held_out_mse.reg < held_out_mse.ols}
            subtext={held_out_mse.reg < held_out_mse.ols
              ? `${((1 - held_out_mse.reg / held_out_mse.ols) * 100).toFixed(1)}% better`
              : `${((held_out_mse.reg / held_out_mse.ols - 1) * 100).toFixed(1)}% worse`}
          />
        </div>
      </div>

      {/* ── 2 — Semi-synthetic recovery ── */}
      <div className="space-y-2">
        <div className="flex items-center">
          <h4 className="text-sm font-medium text-gray-200">2 · Semi-synthetic Recovery</h4>
          <ParamTag type="independent" />
        </div>
        <p className="text-xs text-gray-500">
          OLS betas as ground truth; Gaussian noise added at actual residual scale (fixed seed).
          Pearson r measures how well each method recovers the original contrast z-maps.
          Mildly biased toward OLS since ground truth is derived from OLS.
        </p>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-700">
              <th className="pb-1.5 text-left font-normal">Contrast</th>
              <th className="pb-1.5 text-right font-normal text-blue-400">OLS r</th>
              <th className="pb-1.5 text-right font-normal text-orange-400">Reg r</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(semi_synthetic).map(([name, v]) => (
              <tr key={name} className="border-b border-gray-700/40">
                <td className="py-1.5 text-gray-300 text-xs">{name}</td>
                <td className="py-1.5 text-right font-mono text-blue-300">{fmt(v.recovery_corr_ols)}</td>
                <td className="py-1.5 text-right font-mono text-orange-300">{fmt(v.recovery_corr_reg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 3 — Reproducibility ── */}
      <div className="space-y-2">
        <div className="flex items-center">
          <h4 className="text-sm font-medium text-gray-200">3 · Split-half Reproducibility</h4>
          <ParamTag type="dependent" />
        </div>
        <p className="text-xs text-gray-500">
          Odd vs even timepoints (interleaved, preserves HRF sampling). Map corr = Pearson r between
          full z-maps (unaffected by threshold). Dice = cluster overlap above threshold (affected by p-value
          and cluster threshold).
        </p>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-700">
              <th className="pb-1.5 text-left font-normal">Contrast</th>
              <th className="pb-1.5 text-right font-normal text-blue-400">OLS corr</th>
              <th className="pb-1.5 text-right font-normal text-orange-400">Reg corr</th>
              <th className="pb-1.5 text-right font-normal text-blue-400">OLS Dice</th>
              <th className="pb-1.5 text-right font-normal text-orange-400">Reg Dice</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(reproducibility).map(([name, v]) => (
              <tr key={name} className="border-b border-gray-700/40">
                <td className="py-1.5 text-gray-300 text-xs">{name}</td>
                <td className="py-1.5 text-right font-mono text-blue-300">{fmt(v.map_corr_ols)}</td>
                <td className="py-1.5 text-right font-mono text-orange-300">{fmt(v.map_corr_reg)}</td>
                <td className="py-1.5 text-right font-mono text-blue-300">{fmt(v.dice_ols)}</td>
                <td className="py-1.5 text-right font-mono text-orange-300">{fmt(v.dice_reg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 4 — HRF consistency ── */}
      <div className="space-y-2">
        <div className="flex items-center">
          <h4 className="text-sm font-medium text-gray-200">4 · HRF Consistency — GLM R²</h4>
          <ParamTag type="dependent" />
        </div>
        <p className="text-xs text-gray-500">
          Fraction of BOLD variance explained by the design matrix at each method's significant vertices.
          High R² = vertex genuinely tracked the task. The dropped/added rows reveal whether each method
          is filtering noise or over-smoothing real activations.
        </p>
        <div className="space-y-3 mt-2">
          {Object.entries(hrf_consistency).map(([name, v]) => {
            const olsOnly = v.r2_ols_only;
            const regOnly = v.r2_reg_only;
            let interpretation = null;
            if (olsOnly != null && regOnly != null) {
              if (olsOnly > regOnly + 0.03)
                interpretation = `Reg dropped vertices with R²=${fmt(olsOnly)} — may be over-smoothing real activations.`;
              else if (regOnly > olsOnly + 0.03)
                interpretation = `Reg added higher-R² vertices (${fmt(regOnly)}) — found real signal OLS missed.`;
              else
                interpretation = `Reg dropped low-R² noise (${fmt(olsOnly)}) and kept similar-quality vertices (${fmt(regOnly)}).`;
            }
            return (
              <div key={name} className="bg-gray-700 rounded p-3 space-y-2">
                <p className="text-xs font-medium text-gray-200">{name}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div><span className="text-gray-400">OLS-sig R²: </span><span className="font-mono text-blue-300">{fmt(v.r2_ols_sig)}</span></div>
                  <div><span className="text-gray-400">Reg-sig R²: </span><span className="font-mono text-orange-300">{fmt(v.r2_reg_sig)}</span></div>
                  <div><span className="text-gray-400">OLS-only (Reg dropped): </span><span className="font-mono text-gray-300">{fmt(olsOnly)}</span></div>
                  <div><span className="text-gray-400">Reg-only (Reg added): </span><span className="font-mono text-gray-300">{fmt(regOnly)}</span></div>
                </div>
                {interpretation && <p className="text-xs text-yellow-400/80 italic">{interpretation}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contrast result row
// ---------------------------------------------------------------------------

function ContrastRow({ name, result, image, imgLoading }) {
  const { ols, reg } = result;
  return (
    <div className="bg-gray-700 rounded-lg p-4 space-y-3">
      <h4 className="font-semibold text-gray-100">{name}</h4>
      {image ? (
        <img src={image} alt={`Brain surface: ${name}`} className="w-full rounded" />
      ) : (
        <div className="h-20 flex items-center justify-center gap-2 text-gray-500 text-sm bg-gray-800 rounded">
          {imgLoading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          {imgLoading ? 'Rendering brain surface…' : 'Brain image not available'}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-400 border-b border-gray-600">
              <th className="pb-1 pr-4">Method</th>
              <th className="pb-1 pr-4">Sig+ vertices</th>
              <th className="pb-1 pr-4">Sig− vertices</th>
              <th className="pb-1">Peak |z|</th>
            </tr>
          </thead>
          <tbody className="text-gray-200">
            <tr className="border-b border-gray-600">
              <td className="py-1.5 pr-4 text-blue-400 font-medium">OLS</td>
              <td className="py-1.5 pr-4">{ols.sig_positive.toLocaleString()}</td>
              <td className="py-1.5 pr-4">{ols.sig_negative.toLocaleString()}</td>
              <td className="py-1.5">{ols.peak_z.toFixed(3)}</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-4 text-orange-400 font-medium">Regularized</td>
              <td className="py-1.5 pr-4">{reg.sig_positive.toLocaleString()}</td>
              <td className="py-1.5 pr-4">{reg.sig_negative.toLocaleString()}</td>
              <td className="py-1.5">{reg.peak_z.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LaplacianGLMPage() {
  const [params, setParams]       = useState(DEFAULT_PARAMS);
  const [results, setResults]     = useState(null);
  const [images, setImages]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [error, setError]         = useState(null);
  const pollRef = useRef(null);

  const set = (key, value) => setParams(p => ({ ...p, [key]: value }));

  const startPolling = (jobId) => {
    setImgLoading(true);
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${API_BASE}/status/${jobId}`);
        const data = await res.json();
        if (data.ready) {
          clearInterval(pollRef.current);
          setImages(data.images);
          setImgLoading(false);
        }
      } catch (_) { /* keep polling */ }
    }, 3000);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleRun = async () => {
    if (!API_BASE) {
      setError('API endpoint not configured. Set REACT_APP_GLM_API_URL in your .env file.');
      return;
    }
    clearInterval(pollRef.current);
    setLoading(true);
    setError(null);
    setResults(null);
    setImages(null);
    try {
      // Read params.lambda at call time — avoids stale closure from component body
      const currentLambda = params.lambda;
      const currentSweep  = generateSweep(currentLambda);
      const res = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lambda:            currentLambda,
          lambda_sweep:      currentSweep,
          n_eigenvectors:    params.nEigenvectors,
          p_val:             params.pVal,
          cluster_threshold: params.clusterThreshold,
          two_sided:         params.twoSided,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResults(data);
      if (data.jobId) startPolling(data.jobId);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const sweepData = results
    ? results.sweep.lambdas.map((lam, i) => ({
        lambdaPlot:      lam <= 0 ? 0.001 : lam,
        mse:             results.sweep.mse[i],
        roughness:       results.sweep.roughness[i],
        reproducibility: results.sweep.reproducibility?.[i] ?? null,
      }))
    : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Laplacian-Regularized GLM</h2>
        <p className="text-gray-400 max-w-3xl">
          Interactive surface-based fMRI analysis. Adjust the parameters below and run the
          simulation to see how the Laplacian penalty λ trades off data fit (MSE) against
          spatial smoothness (roughness) across cortical vertices.
        </p>
        <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-400 font-mono space-y-1">
          <p>min<sub>B</sub> ‖Y − XB‖²_F + λ · tr(B L Bᵀ)</p>
          <p className="text-xs text-gray-500">λ = 0 → ordinary OLS &nbsp;|&nbsp; λ → ∞ → maximally smooth map</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Parameter panel */}
        <div className="lg:col-span-1 bg-gray-800 rounded-lg p-5 space-y-5 self-start">
          <h3 className="text-lg font-semibold border-b border-gray-700 pb-2">Parameters</h3>

          <Field label="λ (regularization strength)" hint="0 = OLS · higher = smoother maps. Max 1000.">
            <NumberInput
              value={params.lambda} onChange={v => set('lambda', Math.min(1000, Math.max(0, v)))}
              min={0} max={1000} step={0.01}
            />
          </Field>

          <Field label="λ sweep" hint="Auto-generated from 0 up to the selected λ.">
            <p className="font-mono text-xs text-gray-400 bg-gray-700 rounded px-3 py-2 leading-relaxed">
              {generateSweep(params.lambda).join(', ')}
            </p>
          </Field>

          <SliderWithInput
            label="Eigenvectors (K)"
            hint="Smoothest K modes of the Laplacian. Max 500."
            value={params.nEigenvectors} onChange={v => set('nEigenvectors', v)}
            min={50} max={500} step={50}
          />

          <Field label="p-value threshold" hint="Uncorrected. e.g. 0.001 or 0.005">
            <NumberInput value={params.pVal} onChange={v => set('pVal', v)} min={0.0001} max={0.05} step={0.0001} />
          </Field>

          <Field label="Cluster threshold (vertices)" hint="Min contiguous vertices to count as a cluster. Surface has ~20k vertices total.">
            <NumberInput value={params.clusterThreshold} onChange={v => set('clusterThreshold', v)} min={1} max={5000} step={1} />
          </Field>

          <Field label="Two-sided">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={params.twoSided}
                onChange={e => set('twoSided', e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm text-gray-300">Report positive and negative directions</span>
            </label>
          </Field>

          <button
            onClick={handleRun} disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg transition-colors"
          >
            {loading ? 'Running…' : 'Run Simulation'}
          </button>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded p-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Results panel */}
        <div className="lg:col-span-2 space-y-6">

          {!results && !loading && (
            <div className="bg-gray-800 rounded-lg p-10 text-center text-gray-500">
              <p className="text-4xl mb-3">⚙</p>
              <p>Adjust the parameters and click <strong className="text-gray-400">Run Simulation</strong> to run the pipeline on real fMRI data via AWS Lambda.</p>
            </div>
          )}

          {loading && (
            <div className="bg-gray-800 rounded-lg p-10 text-center text-gray-400">
              <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p>Running on AWS Lambda…</p>
              <p className="text-sm text-gray-500 mt-1">First call may take ~10 s (cold start).</p>
            </div>
          )}

          {results && (
            <>
              {/* Selected λ summary */}
              <div className="bg-gray-800 rounded-lg p-5">
                <h3 className="text-lg font-semibold mb-3">
                  Selected λ = {results.selected.lambda}
                  <span className="text-sm text-gray-400 font-normal ml-2">
                    (K = {results.selected.n_eigenvectors} eigenvectors)
                  </span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'MSE — OLS',         value: results.selected.mse_ols.toFixed(4),      color: 'text-blue-400' },
                    { label: 'MSE — Regularized',  value: results.selected.mse_reg.toFixed(4),      color: 'text-orange-400' },
                    { label: 'Roughness — OLS',    value: results.selected.roughness_ols.toFixed(4), color: 'text-blue-400' },
                    { label: 'Roughness — Reg.',   value: results.selected.roughness_reg.toFixed(4), color: 'text-orange-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-700 rounded p-3 text-center">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className={`text-lg font-mono font-semibold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lambda sweep charts */}
              <div className="bg-gray-800 rounded-lg p-5 space-y-6">
                <h3 className="text-lg font-semibold">λ Sweep</h3>
                <SweepChart
                  data={sweepData} selectedLambda={params.lambda}
                  dataKey="mse" color="#60a5fa"
                  label="In-sample MSE — lower is better"
                />
                <SweepChart
                  data={sweepData} selectedLambda={params.lambda}
                  dataKey="roughness" color="#fb923c"
                  label="Spatial Roughness tr(BLBᵀ)/N — lower is better"
                />
                {sweepData[0]?.reproducibility != null && (
                  <SweepChart
                    data={sweepData} selectedLambda={params.lambda}
                    dataKey="reproducibility" color="#a78bfa"
                    label="Split-half Reproducibility — higher is better"
                  />
                )}
                <p className="text-xs text-gray-500">
                  Red dashed line = currently selected λ. Optimal λ is where reproducibility peaks
                  and roughness has already dropped substantially, before MSE rises steeply.
                </p>
              </div>

              {/* Contrast maps */}
              <div className="bg-gray-800 rounded-lg p-5 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">Contrast Maps</h3>
                  <span className="text-sm text-gray-400">
                    z &gt; {(results.contrasts[Object.keys(results.contrasts)[0]]?.ols.threshold ?? 0).toFixed(3)} (p &lt; {params.pVal})
                  </span>
                  <ParamTag type="dependent" />
                </div>
                {Object.entries(results.contrasts).map(([name, result]) => (
                  <ContrastRow
                    key={name} name={name} result={result}
                    image={images?.[name]} imgLoading={imgLoading}
                  />
                ))}
              </div>

              {/* Evaluation */}
              {results.evaluation && (
                <EvaluationPanel evaluation={results.evaluation} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
