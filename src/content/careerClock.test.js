import { describe, expect, it } from 'vitest';
import { CAREER_START, elapsedSince, parseLocalDate } from './careerClock';

describe('career clock', () => {
  it('starts in October 2022', () => {
    expect(parseLocalDate(CAREER_START)).toEqual(new Date(2022, 9, 1));
  });

  it('counts whole years, months and days, then the clock', () => {
    const t = elapsedSince('2022-10-01', new Date(2026, 10, 17, 14, 5, 9));
    expect(t).toMatchObject({ years: 4, months: 1, days: 16, hours: '14', minutes: '05', seconds: '09' });
  });

  it('keeps the hours right across a daylight-saving change', () => {
    // US clocks fall back on 2026-11-01; local noon is still 12:00 afterwards.
    expect(elapsedSince('2026-10-30', new Date(2026, 10, 2, 12, 0, 0))).toMatchObject({ days: 3, hours: '12', minutes: '00' });
  });

  it('handles a month boundary exactly', () => {
    expect(elapsedSince('2022-10-01', new Date(2022, 11, 1))).toMatchObject({ years: 0, months: 2, days: 0 });
  });

  it('counts total days across a leap year', () => {
    expect(elapsedSince('2023-10-01', new Date(2024, 9, 1)).totalDays).toBe(366);
  });

  it('never goes negative before the start date', () => {
    expect(elapsedSince('2022-10-01', new Date(2022, 0, 1))).toMatchObject({ years: 0, months: 0, days: 0, totalDays: 0 });
  });

  it('rejects a malformed date', () => {
    expect(() => parseLocalDate('Oct 2022')).toThrow();
  });
});
