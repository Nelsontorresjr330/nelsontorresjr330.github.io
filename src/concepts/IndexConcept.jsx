import React from 'react';
import { AREAS, byArea, dateRange } from '../content/portfolio';
import { MaybeLink, ProjectArt, StatusPill, projectHref } from './shared';

// Concept C: "Index". A fixed sidebar with the three areas as chapters; the page scrolls
// through Academic, Professional and Personal in order.
// References (Mobbin): Koto's fixed left rail beside scrolling work, Cartesia's two-column
// serif statement with one accent color.

const tones = {
  live: 'text-teal-700',
  progress: 'text-amber-700',
  planned: 'text-slate-400',
};
const pill = 'text-[11px] font-medium uppercase tracking-wider';

function Sidebar({ profile }) {
  return (
    <aside className="border-b border-slate-200 bg-white px-5 py-6 lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-b-0 lg:py-10">
      <div>
        <p className="text-lg font-semibold tracking-tight text-slate-900">{profile.name}</p>
        <p className="mt-1 text-sm text-slate-500">{profile.role}</p>
      </div>
      <nav aria-label="Chapters" className="mt-6 flex gap-4 text-sm lg:mt-12 lg:flex-col lg:gap-1">
        {AREAS.map((a, i) => (
          <a key={a.id} href={`#${a.id}`} className="group flex items-baseline gap-3 rounded-md py-1 text-slate-600 hover:text-slate-900 lg:px-2 lg:hover:bg-slate-50">
            <span className="hidden font-mono text-[11px] text-slate-400 lg:inline">0{i + 1}</span>
            {a.label}
          </a>
        ))}
      </nav>
      <div className="mt-auto hidden space-y-1 pt-10 text-sm lg:block">
        {profile.links.map((l) => (
          <MaybeLink key={l.label} href={l.href} className="block text-slate-500 hover:text-teal-700">{l.label} ↗</MaybeLink>
        ))}
        <p className="pt-4 text-xs text-slate-400">{profile.location}</p>
      </div>
    </aside>
  );
}

function ProjectRow({ project }) {
  return (
    <MaybeLink href={projectHref(project)}
      className="group grid grid-cols-[72px_1fr] gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-teal-600/40 sm:grid-cols-[112px_1fr]">
      <div className="flex aspect-square items-center justify-center rounded-lg bg-teal-50 text-teal-700">
        <ProjectArt kind={project.art} seed={project.id} className="h-3/4 w-full" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <StatusPill status={project.status} tones={tones} className={pill} />
          <span className="text-xs tabular-nums text-slate-400">{project.year}</span>
        </div>
        <h4 className="mt-1 font-medium leading-snug text-slate-900 group-hover:text-teal-800">{project.title}</h4>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{project.summary}</p>
      </div>
    </MaybeLink>
  );
}

function Chapter({ area, index, projects, experiences }) {
  return (
    <section id={area.id} className="scroll-mt-6 border-t border-slate-200 py-14 first:border-t-0 first:pt-4">
      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr] md:items-start">
        <h2 className="font-serif text-3xl leading-tight text-slate-900 sm:text-4xl">
          <span className="text-teal-700">{area.label}:</span> {area.statement}
        </h2>
        <ul className="space-y-4 md:pt-2">
          {experiences.map((e) => (
            <li key={e.id} className="grid grid-cols-[1fr_auto] gap-x-4">
              <span className="text-sm font-medium text-slate-900">{e.title}</span>
              <span className="text-xs tabular-nums text-slate-400">{dateRange(e)}</span>
              <span className="col-span-2 text-sm text-slate-500">{e.org}</span>
            </li>
          ))}
        </ul>
      </div>
      {projects.length > 0 && (
        <div className="mt-10 grid gap-3 xl:grid-cols-2">
          {projects.map((p) => <ProjectRow key={p.id} project={p} />)}
        </div>
      )}
      <p className="sr-only">Chapter {index + 1}</p>
    </section>
  );
}

export default function IndexConcept({ content }) {
  const { profile, projects, experiences } = content;
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Sidebar profile={profile} />
      <main className="px-5 sm:px-8 lg:ml-72 lg:px-14">
        <div className="mx-auto max-w-4xl">
          <header className="py-12 lg:py-16">
            <p className="max-w-2xl font-serif text-2xl leading-snug text-slate-700 sm:text-3xl">{profile.headline}</p>
          </header>
          {AREAS.map((a, i) => (
            <Chapter key={a.id} area={a} index={i} projects={byArea(projects, a.id)} experiences={byArea(experiences, a.id)} />
          ))}
        </div>
      </main>
    </div>
  );
}
