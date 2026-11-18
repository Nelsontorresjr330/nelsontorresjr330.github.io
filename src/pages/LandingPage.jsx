import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AREAS, AREA_ORDER, PROFILE, TECH_GROUPS, USES, WORK } from '../content/site';

const HEAD = 34;
const ROW = 36;

export function buildStackMap() {
  const work = Object.fromEntries(WORK.map((w) => [w.id, { ...w, tech: [] }]));
  const tech = {};
  TECH_GROUPS.forEach((g) => g.items.forEach((t) => { tech[t.id] = t; }));
  Object.entries(USES).forEach(([t, ids]) => ids.forEach((id) => work[id].tech.push(t)));
  const leftY = {};
  let lh = 0;
  AREA_ORDER.forEach((a) => {
    lh += HEAD;
    WORK.filter((w) => w.area === a).forEach((w) => { leftY[w.id] = lh + ROW / 2; lh += ROW; });
  });
  const rightY = {};
  let rh = 0;
  TECH_GROUPS.forEach((g) => {
    rh += HEAD;
    g.items.forEach((t) => { rightY[t.id] = rh + ROW / 2; rh += ROW; });
  });
  const maxUses = Math.max(...Object.values(USES).map((u) => u.length));
  return { work, tech, leftY, rightY, height: Math.max(lh, rh), maxUses };
}

/** "Archera · Software Developer" -> "Archera" (phones, and lists of names). */
export const shortLabel = (label) => label.split(' · ')[0];

// Hover hysteresis. The outer few pixels of a row don't count as entering it, so a hand resting on
// the border between two rows doesn't flip the whole panel back and forth (measured 2026-11-18: 39
// flips in 40 one-pixel jitters). Anywhere else, the switch is immediate: a time delay was tried
// and felt sluggish (about 140 ms plus the fade). Leaving the map clears after a short grace period.
export const HOVER_EDGE_PX = 3;
export const HOVER_LEAVE_MS = 150;

const link = (y1, y2) => `M0 ${y1}C100 ${y1} 100 ${y2} 200 ${y2}`;

function isExternal(href) {
  return /^https?:/.test(href || '');
}

export default function LandingPage() {
  const map = useMemo(buildStackMap, []);
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);
  const hoverRef = useRef(null);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const commitHover = (id) => {
    clearTimeout(timerRef.current);
    if (hoverRef.current === id) return;
    hoverRef.current = id;
    setHover(id);
  };
  // Pointer moved over a row: switch immediately, except within the row's top and bottom edge,
  // which keeps whatever is showing (so jitter across a border changes nothing).
  const pointerOver = (id) => (e) => {
    clearTimeout(timerRef.current); // back inside the map: cancel a pending clear
    if (id === hoverRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const inEdge = r.height > HOVER_EDGE_PX * 4 && (e.clientY - r.top < HOVER_EDGE_PX || r.bottom - e.clientY < HOVER_EDGE_PX);
    if (inEdge && hoverRef.current !== null) return;
    commitHover(id);
  };
  // Focus moving to another row in the map is a switch, not a clear (avoids a flash on click).
  const blurMap = (e) => {
    if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-testid="stack-map"]')) return;
    commitHover(null);
  };
  const pointerLeaveMap = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { hoverRef.current = null; setHover(null); }, HOVER_LEAVE_MS);
  };
  const act = hover || sel;
  const actWork = act && map.work[act];
  const actTech = act && map.tech[act];

  const onWork = {};
  const onTech = {};
  if (actWork) { onWork[act] = true; actWork.tech.forEach((t) => { onTech[t] = true; }); }
  if (actTech) { onTech[act] = true; USES[act].forEach((id) => { onWork[id] = true; }); }

  let dim = '';
  let lit = '';
  Object.entries(USES).forEach(([t, ids]) => ids.forEach((id) => {
    const d = link(map.leftY[id], map.rightY[t]);
    if ((actWork && id === act) || (actTech && t === act)) lit += d; else dim += d;
  }));
  const litColor = actWork ? AREAS[actWork.area].color : '#7dd3fc';
  const toggle = (id) => setSel((s) => (s === id ? null : id));

  return (
    <div className="pb-20">
      <section className="mx-auto max-w-[1200px] px-6 pt-12 pb-6">
        <h1 className="m-0 text-[clamp(32px,4.4vw,48px)] font-bold tracking-[-0.035em] text-ink">{PROFILE.name}</h1>
        <p className="mt-2.5 max-w-[680px] text-base leading-relaxed text-muted">{PROFILE.subtitle}</p>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-4">
        {/* Fixed height for mouse and trackpad users on purpose: if this panel grew or shrank with
            each item, the rows below would move under the cursor and hover would flip between two
            rows (2026-11-18 bug). Touch screens don't hover, so they get the full text instead. */}
        <div aria-live="polite" data-testid="detail-panel" className="flex min-h-[96px] flex-col justify-center gap-1.5 rounded-[14px] border border-line-strong bg-panel px-5 py-4 pointer-fine:h-[216px] pointer-fine:overflow-hidden sm:pointer-fine:h-[176px] lg:pointer-fine:h-[150px]">
          {!act && (
            <p className="m-0 text-[15px] leading-relaxed text-soft">
              Below are my experiences as a developer, linked to the technologies I used. Hover or select any item to view more.
            </p>
          )}
          {actWork && (
            <>
              <p className="m-0 flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.1em]">
                <span style={{ color: AREAS[actWork.area].color }}>{AREAS[actWork.area].heading}</span>
                <span className="text-faint">·</span>
                <span className="rounded-full bg-raised px-2 py-0.5 tracking-normal text-body">{actWork.when}</span>
              </p>
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="text-[17px] font-semibold text-ink">{actWork.label}</span>
                <span className="min-w-0 pointer-fine:line-clamp-4 flex-[1_1_360px] text-sm leading-normal text-muted">
                  {actWork.summary}
                  {actWork.tech.length > 0 && ` Built with ${actWork.tech.map((t) => map.tech[t].label).join(', ')}.`}
                </span>
                {actWork.href && (isExternal(actWork.href)
                  ? <a href={actWork.href} target="_blank" rel="noopener noreferrer" className="text-sm text-aca-soft no-underline">{actWork.cta} →</a>
                  : <Link to={actWork.href} className="text-sm text-aca-soft no-underline">{actWork.cta} →</Link>)}
              </div>
            </>
          )}
          {actTech && (
            <>
              <p className="m-0 flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.1em]">
                <span className="text-aca-soft">TECHNOLOGY</span>
                <span className="text-faint">·</span>
                <span className="rounded-full bg-raised px-2 py-0.5 tracking-normal text-body">Used In {USES[act].length}</span>
              </p>
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="text-[17px] font-semibold text-ink">{actTech.label}</span>
                <span className="min-w-0 pointer-fine:line-clamp-4 flex-[1_1_360px] text-sm leading-normal text-muted">{USES[act].map((id) => shortLabel(map.work[id].label)).join(', ')}</span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pt-2">
        {/* Hover clears only when the cursor leaves the whole map, never between two rows or over a
            heading: clearing per row made the panel and the dimming flash on every row change. */}
        <div
          data-testid="stack-map"
          onMouseLeave={pointerLeaveMap}
          className="grid grid-cols-[minmax(0,1.25fr)_24px_minmax(0,1fr)] items-start sm:grid-cols-[minmax(0,1.15fr)_minmax(48px,1fr)_minmax(0,0.95fr)]"
        >
          <div>
            {AREA_ORDER.map((a) => (
              <div key={a}>
                <p className="m-0 flex h-[34px] items-end justify-end pr-0.5 pb-1.5 font-mono text-[11px] tracking-[0.12em] whitespace-nowrap" style={{ color: AREAS[a].color }}>
                  {AREAS[a].heading}
                </p>
                {WORK.filter((w) => w.area === a).map((w) => {
                  const on = !act || onWork[w.id];
                  const isAct = act === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      aria-pressed={sel === w.id}
                      onClick={() => { toggle(w.id); commitHover(w.id); }}
                      onMouseMove={pointerOver(w.id)}
                      onFocus={() => commitHover(w.id)}
                      onBlur={blurMap}
                      className="flex h-9 w-full items-center justify-end gap-2.5 rounded-l-lg border-0 pl-2.5 text-right text-sm transition-opacity duration-75"
                      style={{ background: isAct ? '#16161c' : 'transparent', opacity: on ? 1 : 0.28, color: 'var(--color-body)', fontWeight: isAct ? 600 : 500 }}
                    >
                      <span className="min-w-0 truncate sm:hidden">{shortLabel(w.label)}</span>
                      <span className="hidden min-w-0 truncate sm:inline">{w.label}</span>
                      <span className="relative z-10 -mr-1 h-[9px] w-[9px] flex-none rounded-full" style={{ background: AREAS[a].color, boxShadow: '0 0 0 3px var(--color-ground)' }} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <svg viewBox={`0 0 200 ${map.height}`} preserveAspectRatio="none" aria-hidden="true" className="block w-full" style={{ height: map.height }}>
            <path d={dim} fill="none" stroke="#202027" strokeWidth="1" />
            <path d={lit} fill="none" stroke={litColor} strokeWidth="1.6" />
          </svg>
          <div>
            {TECH_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="m-0 flex h-[34px] items-end truncate pl-0.5 pb-1.5 font-mono text-[11px] tracking-[0.12em] whitespace-nowrap text-muted">{g.label}</p>
                {g.items.map((t) => {
                  const on = !act || onTech[t.id];
                  const isAct = act === t.id;
                  const n = USES[t.id].length;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={sel === t.id}
                      onClick={() => { toggle(t.id); commitHover(t.id); }}
                      onMouseMove={pointerOver(t.id)}
                      onFocus={() => commitHover(t.id)}
                      onBlur={blurMap}
                      className="flex h-9 w-full items-center gap-2.5 rounded-r-lg border-0 pr-2.5 text-left font-mono text-[13px] transition-opacity duration-75"
                      style={{ background: isAct ? '#0c1a24' : 'transparent', opacity: on ? 1 : 0.28, color: 'var(--color-body)', fontWeight: isAct ? 600 : 500 }}
                    >
                      <span className="-ml-1 h-[9px] w-[9px] flex-none rounded-full bg-aca-soft" style={{ boxShadow: '0 0 0 3px var(--color-ground)' }} />
                      <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[12px] sm:text-[13px]">{t.label}</span>
                      <span className="hidden h-1 w-14 overflow-hidden rounded-full bg-raised sm:block"><span className="block h-full bg-aca-soft" style={{ width: `${Math.round((n / map.maxUses) * 100)}%` }} /></span>
                      <span className="hidden w-4 text-right font-sans text-xs text-muted sm:block">{n}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
