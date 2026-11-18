import React, { useState } from 'react';
import { AREAS, byArea, dateRange } from '../content/portfolio';
import { MaybeLink, ProjectArt, StatusPill, projectHref } from './shared';

// Concept B: "Lab". Dark, technical, research-forward.
// References (Mobbin): Profound's grid hero, Unseen Studio and Instrument filter chips over a
// project grid, Grok's horizontal "path of progress" timeline.

const tones = {
  live: 'text-emerald-300 border-emerald-400/40',
  progress: 'text-amber-300 border-amber-400/40',
  planned: 'text-zinc-400 border-zinc-600',
};
const pill = 'rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider';
const FILTERS = [{ id: 'all', label: 'All' }, ...AREAS];

function Hero({ profile }) {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">{profile.role}</p>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-medium leading-tight tracking-tight text-white sm:text-6xl">
          {profile.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">{profile.summary}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#work" className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200">See the work</a>
          {profile.links.slice(1, 2).map((l) => (
            <MaybeLink key={l.label} href={l.href} className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500">{l.label}</MaybeLink>
          ))}
        </div>
        <dl className="mx-auto mt-14 grid max-w-2xl grid-cols-3 divide-x divide-zinc-800 border-y border-zinc-800">
          {profile.stats.map((s) => (
            <div key={s.label} className="px-2 py-4">
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-2xl font-medium text-white">{s.value}</dd>
              <dd className="mt-1 text-xs text-zinc-500">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ProjectCard({ project }) {
  return (
    <MaybeLink href={projectHref(project)}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 transition hover:border-zinc-600">
      <div className="relative flex h-36 items-center justify-center bg-zinc-950 text-sky-400/80">
        <ProjectArt kind={project.art} seed={project.id} className="h-28 w-4/5" />
        <StatusPill status={project.status} tones={tones} className={`${pill} absolute top-3 left-3 bg-zinc-950/80`} />
        <span className="absolute top-3 right-3 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{project.area}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-[15px] font-medium leading-snug text-white">{project.title}</h3>
        <p className="text-sm leading-relaxed text-zinc-400">{project.summary}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {project.tags.map((t) => (
            <span key={t} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{t}</span>
          ))}
        </div>
        {projectHref(project) && (
          <span className="pt-1 text-sm text-sky-400 group-hover:text-sky-300">{project.cta} ↗</span>
        )}
      </div>
    </MaybeLink>
  );
}

function HorizontalTimeline({ items }) {
  return (
    <div className="overflow-x-auto pb-2">
      <ol className="relative flex min-w-max gap-0 pt-6">
        <span aria-hidden className="absolute top-[30px] right-0 left-0 h-px bg-zinc-800" />
        {items.map((e, i) => (
          <li key={e.id} className="relative w-64 pr-6">
            <span className={`relative z-10 block h-2 w-2 ${i === 0 ? 'bg-sky-400' : 'bg-zinc-600'}`} />
            <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-zinc-500">{dateRange(e) || '—'}</p>
            <h4 className="mt-1 text-sm font-medium text-white">{e.title}</h4>
            <p className="text-xs text-zinc-500">{e.org}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">{e.summary}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function LabConcept({ content, initialFilter = 'all' }) {
  const { profile, projects, experiences } = content;
  const [filter, setFilter] = useState(initialFilter);
  const shown = byArea(projects, filter);

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="font-mono text-sm tracking-tight">nelson<span className="text-sky-400">.</span>torres</span>
          <nav className="hidden gap-6 text-sm text-zinc-400 sm:flex">
            <a href="#work" className="hover:text-white">Work</a>
            <a href="#timeline" className="hover:text-white">Timeline</a>
            <a href="#about" className="hover:text-white">About</a>
          </nav>
        </div>
      </header>

      <Hero profile={profile} />

      <section id="work" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-medium tracking-tight text-white">Selected work</h2>
          <div role="tablist" aria-label="Filter projects" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const count = byArea(projects, f.id).length;
              return (
                <button key={f.id} role="tab" type="button" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
                  className={`rounded-full px-3 py-1 text-xs transition ${filter === f.id ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:text-white'}`}>
                  {f.label} <sup className="opacity-60">{count}</sup>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      </section>

      <section id="timeline" className="border-t border-zinc-800">
        <div className="mx-auto max-w-6xl space-y-14 px-4 py-16 sm:px-6">
          {AREAS.filter((a) => a.id !== 'personal').map((a) => (
            <div key={a.id}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-medium text-white">{a.label}</h2>
                <p className="hidden text-sm text-zinc-500 sm:block">{a.blurb}</p>
              </div>
              <HorizontalTimeline items={byArea(experiences, a.id)} />
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="border-t border-zinc-800">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-medium text-white">Personal</h2>
            <p className="mt-2 text-sm text-zinc-500">{AREAS[2].blurb}</p>
          </div>
          <ul className="space-y-4">
            {byArea(experiences, 'personal').map((e) => (
              <li key={e.id} className="border-l border-zinc-800 pl-4">
                <p className="text-sm font-medium text-white">{e.title}</p>
                <p className="text-sm text-zinc-400">{e.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-4 py-8 text-center font-mono text-[11px] text-zinc-600">
        {profile.name} · {profile.location}
      </footer>
    </div>
  );
}
