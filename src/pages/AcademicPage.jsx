import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LedgerDetail, LedgerLabel, LedgerRow, PageIntro, Tags } from '../components/Ledger';
import { ACADEMIC_GROUPS, AREAS } from '../content/site';

const ACCENT = AREAS.academic.color;
const SOFT = AREAS.academic.soft;
const ALL = ACADEMIC_GROUPS.flatMap((g) => g.items);

export default function AcademicPage() {
  const [sel, setSel] = useState(ALL[0].id);
  const item = ALL.find((i) => i.id === sel);
  const external = /^https?:/.test(item.href || '');

  return (
    <div>
      <PageIntro title="Academic">
        <p className="mt-2.5 mb-0 max-w-[720px] text-[15px] leading-relaxed text-muted">
          Computational and Data Science Ph.D. Candidate researching fMRI and deep learning at Middle Tennessee State University, advised by Dr. Xin Yang.
        </p>
      </PageIntro>

      <section className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-8 px-6 pt-6 pb-24">
        <div className="min-w-0 flex-[1_1_420px]">
          {ACADEMIC_GROUPS.map((g) => (
            <div key={g.label}>
              <LedgerLabel className="mt-[18px] mb-1.5">{g.label}</LedgerLabel>
              {g.items.map((i) => (
                <LedgerRow key={i.id} selected={i.id === sel} accent={ACCENT} onSelect={() => setSel(i.id)}>{i.title}</LedgerRow>
              ))}
            </div>
          ))}
        </div>
        <LedgerDetail kind={item.kind} accent={SOFT} when={item.when}>
          <h2 className="m-0 text-2xl leading-tight font-bold tracking-[-0.02em] text-ink">{item.title}</h2>
          <p className="m-0 text-sm text-muted">{item.org}</p>
          {item.blocks.map((b) => (
            <div key={b.label}>
              <LedgerLabel className="mb-1 tracking-[0.1em]">{b.label}</LedgerLabel>
              <p className="m-0 text-[15px] leading-relaxed text-soft">{b.text}</p>
            </div>
          ))}
          <Tags tags={item.tags} />
          {item.href && (external ? (
            <a href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center self-start rounded-[10px] bg-sky-100 px-4 text-sm font-semibold text-sky-950 no-underline">{item.cta}</a>
          ) : (
            <Link to={item.href} className="inline-flex min-h-10 items-center self-start rounded-[10px] bg-sky-100 px-4 text-sm font-semibold text-sky-950 no-underline">{item.cta}</Link>
          ))}
        </LedgerDetail>
      </section>
    </div>
  );
}
