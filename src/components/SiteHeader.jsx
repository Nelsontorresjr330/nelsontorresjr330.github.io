import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AREAS, AREA_ORDER, PROFILE } from '../content/site';

export default function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-3.5">
        <Link to="/" className="text-[15px] font-semibold text-ink no-underline">
          {PROFILE.name}
        </Link>
        <nav aria-label="Sections" className="flex flex-wrap gap-1 text-sm">
          {AREA_ORDER.map((id) => (
            <NavLink
              key={id}
              to={AREAS[id].path}
              className="rounded-lg px-3 py-2 no-underline transition-colors"
              style={({ isActive }) =>
                isActive
                  ? { background: `${AREAS[id].color}1f`, color: AREAS[id].soft }
                  : { color: 'var(--color-muted)' }
              }
            >
              {AREAS[id].label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
