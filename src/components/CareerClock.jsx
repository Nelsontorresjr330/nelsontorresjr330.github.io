import React, { useEffect, useState } from 'react';
import { CAREER_START, elapsedSince } from '../content/careerClock';

/** Live "time on the job" counter since full-time engineering began (Oct 2022). Ticks every second. */
export default function CareerClock({ start = CAREER_START, className = '' }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const t = elapsedSince(start, now);
  return (
    <span className={className} aria-label={`${t.years} years, ${t.months} months and ${t.days} days of full-time engineering`}>
      <span className="tabular-nums">{t.years}y {t.months}m {t.days}d</span>{' '}
      <span className="tabular-nums opacity-70">
        {t.hours}:{t.minutes}:{t.seconds}
      </span>
    </span>
  );
}
