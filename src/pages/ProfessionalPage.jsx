import React, { useState } from 'react';
import { useCareerClock } from '../components/CareerClock';
import { LedgerDetail, LedgerLabel, LedgerRow, PageIntro, Tags } from '../components/Ledger';
import { AREAS, EXPERTISE, ROLES } from '../content/site';

const ACCENT = AREAS.professional.color;
const SOFT = AREAS.professional.soft;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function roleSpan(start, end) {
  return `${MONTHS[start[1] - 1]} ${start[0]} – ${end ? `${MONTHS[end[1] - 1]} ${end[0]}` : 'Present'}`;
}

export function roleLength(start, end, today = new Date()) {
  const [ey, em] = end || [today.getFullYear(), today.getMonth() + 1];
  const months = (ey - start[0]) * 12 + (em - start[1]);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [y ? `${y} Yr${y > 1 ? 's' : ''}` : '', m ? `${m} Mo` : ''].filter(Boolean);
  return parts.join(' ') || '< 1 Mo';
}

function ClockCell({ value, label, highlight }) {
  return (
    <div className="px-4 py-2.5 text-center" style={highlight ? { background: '#110d1d' } : undefined}>
      <p className="m-0 font-mono text-[26px]" style={{ color: highlight ? SOFT : 'var(--color-ink)' }}>{value}</p>
      <p className="m-0 font-mono text-[10px] tracking-[0.1em] text-muted">{label}</p>
    </div>
  );
}

export default function ProfessionalPage() {
  const c = useCareerClock();
  const [sel, setSel] = useState(ROLES[0].id);
  const [skill, setSkill] = useState(null);
  const role = ROLES.find((r) => r.id === sel);
  const usedAt = skill ? ROLES.filter((r) => r.tags.includes(skill)).map((r) => r.org) : [];

  return (
    <div>
      <PageIntro title="Professional">
        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <p className="m-0 max-w-[620px] text-[15px] leading-relaxed text-muted">
            Full-time software engineering since October 2022: backend, data and cloud systems. Currently Software Developer at Archera.
          </p>
          <div className="flex divide-x divide-line-strong overflow-hidden rounded-xl border border-line-strong" aria-label={`${c.years} years, ${c.months} months and ${c.days} days of full-time engineering`}>
            <ClockCell value={c.years} label="YEARS" />
            <ClockCell value={c.months} label="MONTHS" />
            <ClockCell value={c.days} label="DAYS" />
            <ClockCell value={`${c.hours}:${c.minutes}:${c.seconds}`} label="SINCE OCT 2022" highlight />
          </div>
        </div>
      </PageIntro>

      <section className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-8 px-6 py-6">
        <div className="min-w-0 flex-[1_1_420px]">
          <LedgerLabel className="mt-[18px] mb-1.5">EXPERIENCE</LedgerLabel>
          {ROLES.map((r) => (
            <LedgerRow key={r.id} selected={r.id === sel} accent={ACCENT} dimmed={!!skill && !r.tags.includes(skill)} onSelect={() => setSel(r.id)}>
              {r.org} <span className="font-normal text-muted">· {r.title}</span>
            </LedgerRow>
          ))}
        </div>
        <LedgerDetail kind="EXPERIENCE" accent={SOFT} when={roleSpan(role.start, role.end)} extra={roleLength(role.start, role.end)}>
          <h2 className="m-0 text-2xl font-bold tracking-[-0.02em] text-ink">{role.title}</h2>
          <p className="m-0 text-sm text-muted">{role.org} · {role.place}</p>
          <ul className="m-0 list-disc mt-1 flex flex-col gap-1.5 pl-[18px] text-[15px] leading-relaxed text-soft">
            {role.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <Tags tags={role.tags} color="#ddd6fe" border="#2a2440" />
        </LedgerDetail>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pt-4 pb-24">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
          <LedgerLabel>EXPERTISE</LedgerLabel>
          <p className="m-0 text-[13px] text-muted" aria-live="polite">
            {skill ? `${skill} · Used At ${usedAt.join(', ')}` : 'Select a skill to see where I used it.'}
          </p>
        </div>
        <div className="border-t border-raised">
          {EXPERTISE.map((g) => (
            <div key={g.label} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-raised py-3">
              <span className="w-[220px] text-sm text-muted">{g.label}</span>
              <div className="flex flex-[1_1_400px] flex-wrap gap-1.5">
                {g.skills.map((s) => {
                  const on = skill === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSkill(on ? null : s)}
                      className="min-h-8 rounded-full border border-solid px-3 font-mono text-xs font-medium"
                      style={{ background: on ? SOFT : 'transparent', color: on ? '#1e1033' : 'var(--color-soft)', borderColor: on ? SOFT : '#27272e' }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
