import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell, ROUTES } from './App';

// Paths that are already public (linked from the paper, résumé and emails). Removing one
// breaks a link someone has; move it with a redirect instead.
const PUBLISHED_PATHS = ['/', '/work', '/projects', '/academic', '/publications', '/personal', '/research/laplacian-glm'];

describe('routes', () => {
  it('keeps every published path', () => {
    const paths = ROUTES.map((r) => r.path);
    for (const p of PUBLISHED_PATHS) expect(paths).toContain(p);
  });

  it.each(PUBLISHED_PATHS)('renders %s with the site header', (path) => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppShell />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Nelson Torres').length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});

describe('current content', () => {
  function renderAt(path) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppShell />
      </MemoryRouter>,
    );
  }

  it('says Archera on the home page, with a live career clock instead of a fixed year count', () => {
    renderAt('/');
    expect(screen.getByText(/Software Developer at Archera/)).toBeInTheDocument();
    expect(screen.queryByText(/SDE3 with Amazon/)).toBeNull();
    expect(screen.queryByText('3+')).toBeNull();
    expect(screen.getByLabelText(/years, \d+ months and \d+ days of full-time engineering/)).toBeInTheDocument();
  });

  it('lists Archera first on the work page and ends the Amazon role', () => {
    renderAt('/work');
    const roles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(roles[0]).toBe('Software Developer, Archera');
    expect(screen.getByText(/Jun 2025 – Jan 2026/)).toBeInTheDocument();
  });

  it('puts PayClear under Olene Software on the personal projects page', () => {
    renderAt('/projects');
    expect(screen.getByText(/Olene Software LLC \(owner\): PayClear/)).toBeInTheDocument();
  });
});
