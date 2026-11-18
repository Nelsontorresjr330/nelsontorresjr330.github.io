import React from 'react';
import { STATUS_LABELS } from '../content/portfolio';

// Deterministic pseudo-random numbers so artwork is stable between renders and snapshots.
function rng(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * Small generated illustration for a project, keyed by `kind`:
 * surface (Laplacian contours), timeseries (BOLD signals), graph (connectome),
 * dynamic (sliding-window connectivity), app (interface blocks), radiation (rays).
 * Colors come from currentColor, so each concept themes it with a text color.
 */
export function ProjectArt({ kind, seed = kind, className = '' }) {
  const r = rng(seed);
  const common = { viewBox: '0 0 160 100', className, role: 'img', 'aria-hidden': true, fill: 'none' };

  if (kind === 'surface') {
    return (
      <svg {...common} stroke="currentColor">
        {Array.from({ length: 7 }, (_, i) => (
          <ellipse key={i} cx={80 + i * 2} cy={52 - i} rx={70 - i * 9} ry={40 - i * 5.2}
            strokeOpacity={0.25 + i * 0.1} strokeWidth="1" />
        ))}
        <circle cx="94" cy="46" r="3" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === 'timeseries') {
    const lines = Array.from({ length: 4 }, (_, k) => {
      const f = 0.06 + r() * 0.08;
      const ph = r() * 6;
      const pts = Array.from({ length: 41 }, (_, i) => {
        const x = i * 4;
        const y = 18 + k * 21 + Math.sin(x * f + ph) * 6 + (r() - 0.5) * 4;
        return `${x},${y.toFixed(1)}`;
      });
      return <polyline key={k} points={pts.join(' ')} stroke="currentColor" strokeOpacity={0.35 + k * 0.18} strokeWidth="1.2" />;
    });
    return <svg {...common}>{lines}</svg>;
  }
  if (kind === 'graph') {
    const nodes = Array.from({ length: 14 }, () => [12 + r() * 136, 10 + r() * 80]);
    const edges = [];
    nodes.forEach((a, i) => nodes.forEach((b, j) => {
      if (j > i && Math.hypot(a[0] - b[0], a[1] - b[1]) < 42) edges.push([a, b]);
    }));
    return (
      <svg {...common} stroke="currentColor">
        {edges.map(([a, b], i) => (
          <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeOpacity="0.35" />
        ))}
        {nodes.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 3.4 : 2.2} fill="currentColor" stroke="none" />
        ))}
      </svg>
    );
  }
  if (kind === 'dynamic') {
    const cells = [];
    for (let w = 0; w < 4; w += 1) {
      for (let i = 0; i < 6; i += 1) {
        for (let j = 0; j < 6; j += 1) {
          cells.push(
            <rect key={`${w}-${i}-${j}`} x={6 + w * 38 + j * 5.2} y={30 + i * 5.2 - w * 4} width="4.6" height="4.6"
              fill="currentColor" fillOpacity={i === j ? 0.9 : 0.1 + r() * 0.6} />,
          );
        }
      }
    }
    return <svg {...common}>{cells}</svg>;
  }
  if (kind === 'radiation') {
    return (
      <svg {...common} stroke="currentColor">
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const len = 18 + r() * 26;
          return <line key={i} x1={80} y1={50} x2={80 + Math.cos(a) * len} y2={50 + Math.sin(a) * len * 0.8} strokeOpacity={0.3 + r() * 0.6} />;
        })}
        <circle cx="80" cy="50" r="5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  // app
  return (
    <svg {...common} stroke="currentColor" strokeOpacity="0.5">
      <rect x="14" y="12" width="132" height="76" rx="6" />
      <line x1="14" y1="26" x2="146" y2="26" />
      <rect x="22" y="34" width="30" height="46" rx="3" fill="currentColor" fillOpacity="0.15" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="60" y={36 + i * 11} width={40 + r() * 40} height="5" rx="2" fill="currentColor" fillOpacity="0.35" stroke="none" />
      ))}
    </svg>
  );
}

const STATUS_TONE = {
  live: 'live',
  'in-progress': 'progress',
  'coming-soon': 'progress',
  planned: 'planned',
};

/** Status label. `tones` maps live/progress/planned to class names, so each concept styles it. */
export function StatusPill({ status, tones, className = '' }) {
  return (
    <span className={`${tones[STATUS_TONE[status]]} ${className}`}>{STATUS_LABELS[status]}</span>
  );
}

export function isExternal(href) {
  return /^https?:\/\//.test(href || '');
}

/** Anchor that opens external links in a new tab. Renders a span when there is no href. */
export function MaybeLink({ href, className, children, ...rest }) {
  if (!href) return <span className={className} {...rest}>{children}</span>;
  return (
    <a href={href} className={className} {...(isExternal(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
      {children}
    </a>
  );
}

/** Only live projects link out; planned demos have no page yet. */
export function projectHref(project) {
  return project.status === 'live' ? project.href : undefined;
}
