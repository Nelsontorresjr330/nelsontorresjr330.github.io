// The live "time on the job" clock shown across the site. Full-time engineering started
// in October 2022 (IPro Systems). Calendar-aware: whole years, then whole months, then
// days and h:m:s from what is left, so Feb and leap years come out right.

export const CAREER_START = '2022-10-01';

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Parses 'YYYY-MM-DD' as local midnight (not UTC, which would shift the day). */
export function parseLocalDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Not a YYYY-MM-DD date: ${iso}`);
  return new Date(y, m - 1, d);
}

/** Time elapsed from `start` to `now`, as calendar years, months, days and a clock. */
export function elapsedSince(start, now = new Date()) {
  const from = start instanceof Date ? start : parseLocalDate(start);
  const to = now instanceof Date ? now : new Date(now);
  if (to < from) return { years: 0, months: 0, days: 0, hours: '00', minutes: '00', seconds: '00', totalDays: 0 };

  let anchor = new Date(from);
  let years = 0;
  let months = 0;
  for (;;) {
    const next = new Date(anchor.getFullYear() + 1, anchor.getMonth(), anchor.getDate());
    if (next > to) break;
    years += 1;
    anchor = next;
  }
  for (;;) {
    const next = new Date(anchor.getFullYear(), anchor.getMonth() + 1, anchor.getDate());
    if (next > to) break;
    months += 1;
    anchor = next;
  }
  // Step whole calendar days too, so a daylight-saving change doesn't shift the hours.
  let days = 0;
  for (;;) {
    const next = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 1);
    if (next > to) break;
    days += 1;
    anchor = next;
  }
  let ms = to - anchor;
  const hours = Math.floor(ms / 3_600_000);
  ms -= hours * 3_600_000;
  const minutes = Math.floor(ms / 60_000);
  ms -= minutes * 60_000;
  return {
    years,
    months,
    days,
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(Math.floor(ms / 1000)),
    totalDays: Math.round((new Date(to.getFullYear(), to.getMonth(), to.getDate()) - from) / 86_400_000),
  };
}
