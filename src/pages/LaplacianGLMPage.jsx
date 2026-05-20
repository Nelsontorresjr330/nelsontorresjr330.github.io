import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

// Base URL — no trailing slash, no path.
// e.g.  REACT_APP_GLM_API_URL=https://xxxx.execute-api.us-east-1.amazonaws.com
const API_BASE = (process.env.REACT_APP_GLM_API_URL || '').replace(/\/$/, '');

const DEFAULT_PARAMS = {
  lambda:           0.1,
  lambdaSweep:      '0.0, 0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0',
  nEigenvectors:    500,
  pVal:             0.001,
  clusterThreshold: 20,
  twoSided:         true,
};

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
      min={min}
      max={max}
      step={step}
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
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 accent-blue-500"
        />
        <NumberInput
          value={value} onChange={onChange}
          min={min} max={max} step={step}
          className="w-24"
        />
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Chart helpers
// ---------------------------------------------------------------------------

const LOG_TICK_VALUES = [0.001, 0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0];

function formatLogTick(v) {
  if (v < 0.01) return '0';
  return v < 1 ? v.toString() : v.toString();
}

function SweepChart({ data, selectedLambda, dataKey, color, label, yLabel }) {
  if (!data || data.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium text-gray-300 mb-2">{label}</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="lambdaPlot"
            scale="log"
            domain={['auto', 'auto']}
            ticks={LOG_TICK_VALUES}
            tickFormatter={formatLogTick}
            label={{ value: 'λ (log scale)', position: 'insideBottom', offset: -12, fill: '#9ca3af', fontSize: 12 }}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fill: '#9ca3af', fontSize: 12 }}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={v => v.toFixed(4)}
            width={70}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#d1d5db' }}
            formatter={(v, name) => [v.toFixed(6), name]}
            labelFormatter={v => `λ = ${v}`}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 4, fill: color }}
            name={label}
          />
          <ReferenceLine
            x={selectedLambda <= 0 ? 0.001 : selectedLambda}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: `λ=${selectedLambda}`, fill: '#ef4444', fontSize: 11, position: 'top' }}
          />
        </LineChart>
      </ResponsiveContainer>
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

      {/* Brain surface image — OLS left, Regularized right */}
      {image ? (
        <img
          src={image}
          alt={`Brain surface: ${name}`}
          className="w-full rounded"
        />
      ) : (
        <div className="h-20 flex items-center justify-center gap-2 text-gray-500 text-sm bg-gray-800 rounded">
          {imgLoading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          {imgLoading ? 'Rendering brain surface…' : 'Brain image not available'}
        </div>
      )}

      {/* Stats table */}
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
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [results, setResults]   = useState(null);
  const [images, setImages]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [error, setError]       = useState(null);
  const pollRef = useRef(null);

  const set = (key, value) => setParams(p => ({ ...p, [key]: value }));

  const parseSweep = () =>
    params.lambdaSweep
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(v => !isNaN(v));

  // Poll /status/{jobId} every 3 s until images are ready
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

  // Clean up polling on unmount
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
      const res = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lambda:            params.lambda,
          lambda_sweep:      parseSweep(),
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

  // Build chart-friendly sweep data
  const sweepData = results
    ? results.sweep.lambdas.map((lam, i) => ({
        lambdaPlot: lam <= 0 ? 0.001 : lam,
        mse:        results.sweep.mse[i],
        roughness:  results.sweep.roughness[i],
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

        {/* ----------------------------------------------------------------
            Parameter panel
        ---------------------------------------------------------------- */}
        <div className="lg:col-span-1 bg-gray-800 rounded-lg p-5 space-y-5 self-start">
          <h3 className="text-lg font-semibold border-b border-gray-700 pb-2">Parameters</h3>

          <SliderWithInput
            label="λ (selected)"
            hint="Regularization strength for contrast maps"
            value={params.lambda}
            onChange={v => set('lambda', v)}
            min={0.0} max={5.0} step={0.01}
          />

          <Field
            label="λ sweep values"
            hint="Comma-separated list. 0.0 = OLS baseline."
          >
            <textarea
              rows={2}
              value={params.lambdaSweep}
              onChange={e => set('lambdaSweep', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500 resize-none"
            />
          </Field>

          <SliderWithInput
            label="Eigenvectors (K)"
            hint="Smoothest K modes of the Laplacian. Max 500."
            value={params.nEigenvectors}
            onChange={v => set('nEigenvectors', v)}
            min={50} max={500} step={50}
          />

          <Field label="p-value threshold" hint="Uncorrected. e.g. 0.001 or 0.005">
            <NumberInput
              value={params.pVal}
              onChange={v => set('pVal', v)}
              min={0.0001} max={0.05} step={0.0001}
            />
          </Field>

          <Field label="Cluster threshold (vertices)" hint="Min vertices to report">
            <NumberInput
              value={params.clusterThreshold}
              onChange={v => set('clusterThreshold', v)}
              min={1} max={200} step={1}
            />
          </Field>

          <Field label="Two-sided">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={params.twoSided}
                onChange={e => set('twoSided', e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm text-gray-300">Report positive and negative directions</span>
            </label>
          </Field>

          <button
            onClick={handleRun}
            disabled={loading}
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

        {/* ----------------------------------------------------------------
            Results panel
        ---------------------------------------------------------------- */}
        <div className="lg:col-span-2 space-y-6">

          {/* Placeholder when no results yet */}
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
                    { label: 'MSE — OLS',        value: results.selected.mse_ols.toFixed(6), color: 'text-blue-400' },
                    { label: 'MSE — Regularized', value: results.selected.mse_reg.toFixed(6), color: 'text-orange-400' },
                    { label: 'Roughness — OLS',   value: results.selected.roughness_ols.toFixed(4), color: 'text-blue-400' },
                    { label: 'Roughness — Reg.',  value: results.selected.roughness_reg.toFixed(4), color: 'text-orange-400' },
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
                <h3 className="text-lg font-semibold">λ Sweep — Fit quality vs Smoothness</h3>
                <SweepChart
                  data={sweepData}
                  selectedLambda={params.lambda}
                  dataKey="mse"
                  color="#60a5fa"
                  label="In-sample MSE"
                  yLabel="MSE"
                />
                <SweepChart
                  data={sweepData}
                  selectedLambda={params.lambda}
                  dataKey="roughness"
                  color="#fb923c"
                  label="Spatial Roughness  tr(B L Bᵀ) / N"
                  yLabel="Roughness"
                />
                <p className="text-xs text-gray-500">
                  Red dashed line = currently selected λ. The optimal λ lives in the elbow where MSE
                  starts rising steeply while roughness has already dropped substantially.
                </p>
              </div>

              {/* Contrast results */}
              <div className="bg-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold">
                  Contrast Maps
                  <span className="text-sm text-gray-400 font-normal ml-2">
                    z &gt; {(results.contrasts[Object.keys(results.contrasts)[0]]?.ols.threshold ?? '').toFixed(3)} (p &lt; {params.pVal})
                  </span>
                </h3>
                {Object.entries(results.contrasts).map(([name, result]) => (
                  <ContrastRow
                    key={name}
                    name={name}
                    result={result}
                    image={images?.[name]}
                    imgLoading={imgLoading}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
