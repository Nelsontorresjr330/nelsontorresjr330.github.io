import React from 'react';

/** Section label in the ledger style (mono, tracked). */
export function LedgerLabel({ children, className = '' }) {
  return <p className={`m-0 font-mono text-[11px] tracking-[0.14em] text-muted ${className}`}>{children}</p>;
}

/** One selectable row: a dot, the title, and an arrow when selected. */
export function LedgerRow({ selected, accent, dimmed = false, onSelect, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="flex min-h-[50px] w-full items-center gap-3 border-0 border-t border-solid border-raised px-3.5 text-left text-[15px] transition-opacity"
      style={{
        background: selected ? `${accent}14` : 'transparent',
        color: selected ? 'var(--color-ink)' : 'var(--color-soft)',
        fontWeight: selected ? 600 : 500,
        opacity: dimmed ? 0.3 : 1,
      }}
    >
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: selected ? accent : '#3f3f46' }} />
      <span className="flex-1">{children}</span>
      <span aria-hidden="true" className="text-faint">{selected ? '→' : ''}</span>
    </button>
  );
}

/** The detail panel: kind and status/date on top, then the content. */
export function LedgerDetail({ kind, accent, when, extra, children }) {
  return (
    <aside className="mt-[18px] flex min-w-0 flex-[1.15_1_440px] flex-col gap-3 rounded-2xl border border-line-strong bg-panel p-6">
      <p className="m-0 flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.1em]">
        <span style={{ color: accent }}>{kind}</span>
        <span className="rounded-full bg-raised px-2 py-0.5 tracking-normal text-body">{when}</span>
        {extra && <span className="tracking-normal text-muted">{extra}</span>}
      </p>
      {children}
    </aside>
  );
}

export function Tags({ tags, color = '#d4d4d8', border = '#23232a' }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="rounded-full border border-solid px-2.5 py-0.5 font-mono text-[11px]" style={{ color, borderColor: border }}>{t}</span>
      ))}
    </div>
  );
}

export function PageIntro({ title, children }) {
  return (
    <section className="mx-auto max-w-[1200px] border-b border-raised px-6 pt-12 pb-7">
      <h1 className="m-0 text-[40px] font-bold tracking-[-0.03em] text-ink">{title}</h1>
      {children}
    </section>
  );
}
