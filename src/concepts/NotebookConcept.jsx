import React, { useState } from 'react';
import { AREAS, byArea, dateRange } from '../content/portfolio';
import { MaybeLink, ProjectArt, StatusPill, projectHref } from './shared';

// Concept A: "Notebook". Light, editorial, quiet. Closest to obra.work.
// References (Mobbin): metic. hero (big name, short bio beside it) and its "road so far"
// timeline; Locomotive's project index (a plain list with columns).

const tones = {
  live: 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200',
  progress: 'text-amber-800 bg-amber-50 ring-1 ring-amber-200',
  planned: 'text-slate-600 bg-slate-100 ring-1 ring-slate-200',
};
const pill = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium';

function Nav({ area, onArea }) {
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#f7f6f3]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <span className="shrink-0 text-sm font-semibold tracking-tight text-slate-900">
          <span className="sm:hidden" aria-hidden>NT</span>
          <span className="sr-only sm:not-sr-only">Nelson Torres</span>
        </span>
        <nav aria-label="Sections" className="flex gap-0.5 overflow-x-auto text-[13px] sm:gap-1 sm:text-sm">
          {AREAS.map((a) => (
            <button key={a.id} type="button" onClick={() => onArea(a.id)}
              className={`rounded-md px-2.5 py-1 whitespace-nowrap transition ${area === a.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-stone-200/70'}`}>
              {a.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Hero({ profile }) {
  return (
    <section className="mx-auto grid max-w-5xl gap-8 px-4 pt-14 pb-10 sm:px-6 md:grid-cols-[1.4fr_1fr] md:items-end md:pt-20">
      <h1 className="font-serif text-5xl leading-[0.95] tracking-tight text-slate-900 sm:text-7xl">
        {profile.name}.
      </h1>
      <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
        <p>{profile.summary}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {profile.links.map((l) => (
            <MaybeLink key={l.label} href={l.href} className="text-slate-900 underline decoration-stone-300 underline-offset-4 hover:decoration-slate-900">
              {l.label}
            </MaybeLink>
          ))}
        </div>
      </div>
    </section>
  );
}

function Featured({ project }) {
  return (
    <MaybeLink href={projectHref(project)}
      className="group mx-auto mb-14 grid max-w-5xl overflow-hidden rounded-2xl border border-stone-200 bg-white sm:grid-cols-[1fr_1.1fr]">
      <div className="flex items-center justify-center bg-stone-100 p-8 text-slate-800">
        <ProjectArt kind={project.art} seed={project.id} className="h-40 w-full max-w-xs" />
      </div>
      <div className="space-y-3 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <StatusPill status={project.status} tones={tones} className={pill} />
          <span>Research demo</span>
        </div>
        <h2 className="font-serif text-2xl leading-snug text-slate-900">{project.title}</h2>
        <p className="text-sm leading-relaxed text-slate-600">{project.summary}</p>
        <span className="inline-block pt-1 text-sm font-medium text-slate-900 group-hover:underline">
          {project.cta} →
        </span>
      </div>
    </MaybeLink>
  );
}

function ProjectIndex({ items }) {
  return (
    <ul className="divide-y divide-stone-200 border-y border-stone-200">
      {items.map((p) => (
        <li key={p.id}>
          <MaybeLink href={projectHref(p)}
            className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 py-4 sm:grid-cols-[2fr_1fr_auto_auto] hover:bg-white/60">
            <span className="text-[15px] font-medium text-slate-900">{p.title}</span>
            <span className="hidden text-sm text-slate-500 sm:block">{p.tags.slice(0, 2).join(' · ')}</span>
            <StatusPill status={p.status} tones={tones} className={`${pill} justify-self-end`} />
            <span className="hidden w-16 text-right text-sm tabular-nums text-slate-400 sm:block">{p.year}</span>
            <span className="col-span-2 text-sm leading-relaxed text-slate-600 sm:col-span-4 sm:max-w-2xl">{p.summary}</span>
          </MaybeLink>
        </li>
      ))}
    </ul>
  );
}

function Timeline({ items }) {
  return (
    <ol className="relative space-y-8 border-l border-stone-300 pl-6">
      {items.map((e, i) => (
        <li key={e.id} className="relative">
          <span className={`absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[#f7f6f3] ${i === 0 ? 'bg-rose-600' : 'bg-stone-400'}`} />
          <p className="text-xs tabular-nums text-slate-500">{dateRange(e)}</p>
          <h4 className="mt-0.5 font-medium text-slate-900">{e.title}</h4>
          <p className="text-sm text-slate-500">{e.org}</p>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">{e.summary}</p>
        </li>
      ))}
    </ol>
  );
}

export default function NotebookConcept({ content, initialArea = 'academic' }) {
  const { profile, projects, experiences } = content;
  const [area, setArea] = useState(initialArea);
  const meta = AREAS.find((a) => a.id === area);
  const featured = byArea(projects, area).find((p) => p.featured);
  const rest = byArea(projects, area).filter((p) => p !== featured);

  return (
    <div className="min-h-screen bg-[#f7f6f3] font-sans text-slate-900 antialiased">
      <Nav area={area} onArea={setArea} />
      <Hero profile={profile} />

      <div className="px-4 sm:px-6">
        <div className="mx-auto mb-6 flex max-w-5xl items-baseline justify-between border-t border-stone-300 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">{meta.label}</h2>
          <p className="hidden text-sm text-slate-500 sm:block">{meta.blurb}</p>
        </div>
        {featured && <Featured project={featured} />}
        <section className="mx-auto grid max-w-5xl gap-12 pb-24 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h3 className="mb-4 text-sm font-medium text-slate-500">Projects</h3>
            <ProjectIndex items={rest} />
          </div>
          <div>
            <h3 className="mb-5 text-sm font-medium text-slate-500">The road so far</h3>
            <Timeline items={byArea(experiences, area)} />
          </div>
        </section>
      </div>

      <footer className="border-t border-stone-200 px-4 py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {profile.name} · {profile.location}
      </footer>
    </div>
  );
}
