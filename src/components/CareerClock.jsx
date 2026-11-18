import { useEffect, useState } from 'react';
import { CAREER_START, elapsedSince } from '../content/careerClock';

/** Live time since full-time engineering began (Oct 2022), ticking every second. */
export function useCareerClock(start = CAREER_START) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return elapsedSince(start, now);
}
