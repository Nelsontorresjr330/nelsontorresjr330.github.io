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
