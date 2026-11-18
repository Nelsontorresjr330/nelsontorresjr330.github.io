import React, { useState } from 'react';
import { INTERESTS, OLENE_APPS, OLENE_STATUS, PHOTOS } from '../content/site';

export default function PersonalPage() {
  const [appName, setAppName] = useState(OLENE_APPS[0].name);
  const [photo, setPhoto] = useState(0);
  const app = OLENE_APPS.find((a) => a.name === appName);
  const status = OLENE_STATUS[app.status];

  return (
    <div className="pb-24">
      <section className="mx-auto max-w-[1200px] px-6 pt-16 pb-4">
        <h1 className="m-0 text-[clamp(36px,4.5vw,52px)] leading-tight font-bold tracking-[-0.035em] text-ink">Personal</h1>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-6">
        <div className="rounded-[20px] border border-line-strong bg-panel p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="m-0 text-[26px] font-bold tracking-[-0.02em] text-ink">Olene Software LLC</h2>
              <p className="mt-1.5 mb-0 max-w-[600px] text-[15px] leading-relaxed text-muted">Owner. Software for small businesses and the trades.</p>
            </div>
            <a href="https://olenesoft.com" target="_blank" rel="noopener noreferrer" className="text-sm text-per-soft no-underline">olenesoft.com ↗</a>
          </div>

          <div role="tablist" aria-label="Olene apps" className="mt-6 flex flex-wrap gap-1.5">
            {OLENE_APPS.map((a) => {
              const on = a.name === appName;
              const st = OLENE_STATUS[a.status];
              return (
                <button
                  key={a.name}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setAppName(a.name)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-solid px-3.5 text-sm"
                  style={{ borderColor: on ? '#fb923c' : '#23232a', background: on ? '#1c1209' : 'transparent', color: on ? 'var(--color-ink)' : 'var(--color-soft)', fontWeight: on ? 600 : 500 }}
                >
                  {a.name}
                  <span className="font-mono text-[10px] uppercase" style={{ color: st.color }}>{st.label}</span>
                </button>
              );
            })}
          </div>

          <div role="tabpanel" aria-label={app.name} className="mt-5 flex flex-wrap items-start gap-6">
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
              <h3 className="m-0 text-[22px] font-bold tracking-[-0.02em] text-ink">{app.name}</h3>
              <p className="m-0 font-mono text-[11px] uppercase" style={{ color: status.color }}>{status.label}</p>
              <p className="m-0 text-[15px] leading-relaxed text-soft">{app.what}</p>
              <ul className="m-0 list-disc flex flex-col gap-1 pl-[18px] text-sm leading-normal text-muted">
                {app.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
              <div className="flex flex-wrap gap-1.5">
                {app.tags.map((t) => <span key={t} className="rounded-md bg-raised px-2 py-0.5 font-mono text-[11px] text-soft">{t}</span>)}
              </div>
              <a href={app.href} target="_blank" rel="noopener noreferrer" className="text-sm text-per-soft no-underline">{app.name} on olenesoft.com ↗</a>
            </div>
            <figure className="m-0 min-w-0 flex-[2_1_460px]">
              <img src={app.shot} alt={`${app.name} screenshot`} className="block w-full rounded-xl border border-line-strong" />
              <figcaption className="mt-2 text-xs text-muted">{app.caption}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-7 px-6 py-6">
        <div className="flex-[1_1_280px]">
          <h2 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-ink">Interests</h2>
          <p className="mt-2 mb-0 text-[15px] leading-relaxed text-muted">{INTERESTS}</p>
          <div className="mt-4 flex items-center gap-2">
            <button type="button" aria-label="Previous photo" onClick={() => setPhoto((photo + PHOTOS.length - 1) % PHOTOS.length)} className="h-11 w-11 rounded-full border border-solid border-[#27272a] bg-transparent text-lg text-ink">←</button>
            <button type="button" aria-label="Next photo" onClick={() => setPhoto((photo + 1) % PHOTOS.length)} className="h-11 w-11 rounded-full border border-solid border-[#27272a] bg-transparent text-lg text-ink">→</button>
            <span className="ml-2 font-mono text-xs text-muted">{photo + 1} / {PHOTOS.length}</span>
          </div>
        </div>
        <div className="aspect-[4/3] min-w-0 flex-[1.4_1_420px] overflow-hidden rounded-[18px] border border-line">
          <img src={PHOTOS[photo].src} alt={PHOTOS[photo].alt} className="block h-full w-full object-cover" />
        </div>
      </section>
    </div>
  );
}
