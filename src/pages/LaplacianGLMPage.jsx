import React, { useState, useEffect, useRef } from 'react';

const API_BASE = (process.env.REACT_APP_GLM_API_URL || '').replace(/\/$/, '');

// Defaults = the optimal multi-dataset configuration from the parameter search.
const DEFAULT_PARAMS = {
  lambda:           2.66,
  nEigenvectors:    1000,
  pVal:             '6.45e-5',
  clusterThreshold: 19,
};

const METRIC_LABELS = {
  generalization:  'Generalization',
  reproducibility: 'Reproducibility',
  hrf_consistency: 'HRF consistency',
  recovery:        'Recovery',
};
const METRIC_ORDER = ['generalization', 'reproducibility', 'hrf_consistency', 'recovery'];

// ---------------------------------------------------------------------------
// Small controls
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

function NumberInput({ value, onChange, min, max, step }) {
  return (
    <input
      type="number" value={value} min={min} max={max} step={step}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
    />
  );
}

// A signed metric bar: green to the right for positive, red to the left for negative.
function MetricBar({ label, value }) {
  const pct = value * 100;
  const mag = Math.min(Math.abs(pct), 100);
  const pos = pct >= 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className={`font-mono ${pos ? 'text-green-400' : 'text-orange-400'}`}>
          {pos ? '+' : ''}{pct.toFixed(1)}%
        </span>
      </div>
      <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-500" />
        <div
          className={`absolute top-0 bottom-0 ${pos ? 'bg-green-500' : 'bg-orange-500'}`}
          style={pos
            ? { left: '50%', width: `${mag / 2}%` }
            : { right: '50%', width: `${mag / 2}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-dataset section
// ---------------------------------------------------------------------------

function DatasetSection({ name, data, images }) {
  const scorePct = data.score * 100;
  return (
    <div className="bg-gray-800 rounded-lg p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{data.label}</h3>
        <span className={`text-xl font-mono font-bold ${scorePct >= 0 ? 'text-green-400' : 'text-orange-400'}`}>
          {scorePct >= 0 ? '+' : ''}{scorePct.toFixed(1)}%
        </span>
      </div>

      {/* Metric improvement bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {METRIC_ORDER.filter(k => data.dims[k] !== undefined).map(k => (
          <MetricBar key={k} label={METRIC_LABELS[k]} value={data.dims[k]} />
        ))}
      </div>

      {/* Brain-scan comparisons, one per contrast */}
      <div className="space-y-4 pt-1">
        {Object.entries(data.contrasts).map(([cname, stats]) => (
          <div key={cname} className="bg-gray-700 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <h4 className="text-sm font-medium text-gray-100">{cname}</h4>
              <span className="text-xs text-gray-400 font-mono">
                sig vertices — OLS {stats.ols.sig_positive + stats.ols.sig_negative} ·
                {' '}Reg {stats.reg.sig_positive + stats.reg.sig_negative}
              </span>
            </div>
            {images?.[name]?.[cname] ? (
              <img src={images[name][cname]} alt={`${name} ${cname}`} className="w-full rounded" />
            ) : (
              <div className="h-24 flex items-center justify-center gap-2 text-gray-500 text-sm bg-gray-800 rounded">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Rendering brain surfaces…
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LaplacianGLMPage() {
  const [params, setParams]   = useState(DEFAULT_PARAMS);
  const [results, setResults] = useState(null);
  const [images, setImages]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState('');
  const [error, setError]     = useState(null);
  const pollRef = useRef(null);

  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));

  const startPolling = (jobId) => {
    setStatus('Computing metrics and rendering brain surfaces across 3 datasets…');
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${API_BASE}/status/${jobId}`);
        const data = await res.json();
        if (data.ready) {
          clearInterval(pollRef.current);
          setResults(data.results);
          setImages(data.images);
          setLoading(false);
          setStatus('');
        }
      } catch (_) { /* keep polling */ }
    }, 3000);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleRun = async () => {
    if (!API_BASE) { setError('API endpoint not configured (REACT_APP_GLM_API_URL).'); return; }
    const pv = parseFloat(params.pVal);
    if (isNaN(pv) || pv <= 0 || pv >= 1) { setError('Enter a valid p-value (e.g. 0.001 or 6.45e-5).'); return; }
    clearInterval(pollRef.current);
    setLoading(true); setError(null); setResults(null); setImages(null);
    try {
      const res = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lambda:            params.lambda,
          n_eigenvectors:    params.nEigenvectors,
          p_val:             pv,
          cluster_threshold: params.clusterThreshold,
          two_sided:         true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.jobId) startPolling(data.jobId);
      else throw new Error('No jobId returned');
    } catch (e) {
      setError(e.message); setLoading(false);
    }
  };

  const combinedPct = results ? results.combined * 100 : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Laplacian-Regularized GLM</h2>
        <p className="text-gray-400 max-w-3xl">
          Surface-based fMRI analysis with a cortical-geometry penalty, evaluated across
          <strong className="text-gray-300"> three independent datasets</strong>. Adjust the
          parameters and run to compare the regularized estimator against standard OLS on
          each dataset — by metric improvements and by brain-surface activation maps.
        </p>
        <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-400 font-mono">
          <p>min<sub>B</sub> ‖Y − XB‖²_F + λ · tr(B L Bᵀ)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Params */}
        <div className="lg:col-span-1 bg-gray-800 rounded-lg p-5 space-y-5 self-start">
          <h3 className="text-lg font-semibold border-b border-gray-700 pb-2">Parameters</h3>

          <Field label="λ (regularization strength)" hint="0 = OLS · higher = smoother maps">
            <NumberInput value={params.lambda} onChange={v => set('lambda', Math.min(1000, Math.max(0, v)))} min={0} max={1000} step={0.01} />
          </Field>

          <Field label="Eigenvectors (K)" hint="Smoothest K Laplacian modes. Max 1000.">
            <NumberInput value={params.nEigenvectors} onChange={v => set('nEigenvectors', v)} min={50} max={1000} step={50} />
          </Field>

          <Field label="p-value threshold" hint="Decimal or scientific notation, e.g. 6.45e-5">
            <input
              type="text" value={params.pVal} onChange={e => set('pVal', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </Field>

          <Field label="Cluster threshold (vertices)" hint="Min contiguous vertices to keep.">
            <NumberInput value={params.clusterThreshold} onChange={v => set('clusterThreshold', v)} min={1} max={5000} step={1} />
          </Field>

          <button
            onClick={handleRun} disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg transition-colors"
          >
            {loading ? 'Running…' : 'Run Simulation'}
          </button>

          <p className="text-xs text-gray-500">
            Defaults are the search-optimal configuration. A run computes 3 datasets and
            renders their brain maps — expect ~1–2 minutes.
          </p>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded p-3 text-sm text-red-300">{error}</div>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {!results && !loading && (
            <div className="bg-gray-800 rounded-lg p-10 text-center text-gray-500">
              <p className="text-4xl mb-3">🧠</p>
              <p>Adjust the parameters and click <strong className="text-gray-400">Run Simulation</strong>.</p>
            </div>
          )}

          {loading && (
            <div className="bg-gray-800 rounded-lg p-10 text-center text-gray-400">
              <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p>{status || 'Running on AWS Lambda…'}</p>
              <p className="text-sm text-gray-500 mt-1">Fitting + rendering across 3 datasets.</p>
            </div>
          )}

          {results && (
            <>
              {/* Combined headline */}
              <div className="bg-gray-800 rounded-lg p-5">
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-lg font-semibold">Overall Improvement</h3>
                    <p className="text-xs text-gray-500">
                      Mean reg-vs-OLS improvement across all 3 datasets · λ={results.selected.lambda},
                      K={results.selected.n_eigenvectors}, p={params.pVal}, cluster={results.selected.cluster_threshold}
                    </p>
                  </div>
                  <span className={`text-4xl font-mono font-bold ${combinedPct >= 0 ? 'text-green-400' : 'text-orange-400'}`}>
                    {combinedPct >= 0 ? '+' : ''}{combinedPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Per-dataset sections */}
              {Object.entries(results.datasets).map(([name, data]) => (
                <DatasetSection key={name} name={name} data={data} images={images} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
