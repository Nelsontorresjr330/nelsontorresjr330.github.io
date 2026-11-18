import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppShell, ROUTES } from './App';
import { HOVER_LEAVE_MS } from './pages/LandingPage';

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

function renderAt(path) {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  return render(<MemoryRouter initialEntries={[path]}><AppShell /><Where /></MemoryRouter>);
}

const CLOCK = /years, \d+ months and \d+ days of full-time engineering/;

describe('routes', () => {
  it('keeps the published demo path and the three section pages', () => {
    expect(ROUTES.map((r) => r.path)).toEqual(['/', '/professional', '/academic', '/personal', '/research/laplacian-glm']);
  });

  it.each(['/', '/professional', '/academic', '/personal', '/research/laplacian-glm'])('renders %s with the header', (path) => {
    renderAt(path);
    expect(screen.getByRole('link', { name: 'Nelson Torres' })).toBeInTheDocument();
  });

  it.each([['/work', '/professional'], ['/projects', '/personal'], ['/publications', '/academic']])('sends %s to %s', (from, to) => {
    renderAt(from);
    expect(screen.getByTestId('where')).toHaveTextContent(to);
  });

  it('shows a not-found page for unknown paths', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('orders the nav Professional, Academic, Personal', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Professional', 'Academic', 'Personal']);
  });

  it('shows the career clock on the Professional page only', () => {
    for (const path of ['/', '/academic', '/personal', '/research/laplacian-glm']) {
      const { unmount } = renderAt(path);
      expect(screen.queryByLabelText(CLOCK), path).toBeNull();
      unmount();
    }
    renderAt('/professional');
    expect(screen.getByLabelText(CLOCK)).toBeInTheDocument();
  });
});

describe('landing page (stack map)', () => {
  it('opens with instructions, not counts', () => {
    renderAt('/');
    expect(screen.getByText(/Below are my experiences as a developer/)).toBeInTheDocument();
    expect(screen.queryByText(/Technologies$/)).toBeNull();
  });

  it('shows the date range at the top of the detail when a role is selected', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /Archera · Software Developer/ }));
    expect(screen.getByText('Jan 2026 – Present')).toBeInTheDocument();
    expect(screen.getByText(/Built with Python, TypeScript/)).toBeInTheDocument();
  });

  it('shows how many items use a technology when it is selected', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /^AWS CDK/ }));
    expect(screen.getByText(/Used In 7/)).toBeInTheDocument();
  });

  it('keeps the detail panel a fixed height for mouse users, so hovering never moves the rows', () => {
    // Regression (2026-11-18): the panel resized with each item, shifting the rows under the
    // cursor so hover flipped between two of them. The height must not depend on content.
    renderAt('/');
    const panel = screen.getByTestId('detail-panel');
    for (const cls of ['pointer-fine:h-[216px]', 'sm:pointer-fine:h-[176px]', 'lg:pointer-fine:h-[150px]', 'pointer-fine:overflow-hidden']) {
      expect(panel.className).toContain(cls);
    }
    fireEvent.mouseMove(screen.getByRole('button', { name: /Archera · Software Developer/ }));
    expect(panel.querySelector('.pointer-fine\\:line-clamp-4')).not.toBeNull();
  });

  it('switches rows immediately, but jitter on the border between two rows changes nothing', () => {
    // Regressions (2026-11-18): resting on the Archera/Amazon border flipped the panel on every
    // one-pixel tremor (39 flips in 40 moves); a 90 ms hover delay fixed that but felt sluggish.
    // Now: the outer HOVER_EDGE_PX of a row never switches; anywhere else switches at once.
    vi.useFakeTimers();
    const rects = new Map();
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
      return rects.get(this) || { top: 0, bottom: 0, left: 0, right: 0, height: 0, width: 0, x: 0, y: 0 };
    });
    try {
      renderAt('/');
      const archera = screen.getByRole('button', { name: /Archera · Software Developer/ });
      const amazon = screen.getByRole('button', { name: /Amazon · Senior Software Engineer/ });
      rects.set(archera, { top: 100, bottom: 136, height: 36, left: 0, right: 300, width: 300, x: 0, y: 100 });
      rects.set(amazon, { top: 136, bottom: 172, height: 36, left: 0, right: 300, width: 300, x: 0, y: 136 });
      const heading = screen.getAllByText('ACADEMIC').find((el) => el.tagName === 'P');

      fireEvent.mouseMove(archera, { clientY: 118 });
      expect(screen.getByText('Jan 2026 – Present')).toBeInTheDocument();
      // A resting hand on the border: one pixel either side, twenty times.
      for (let i = 0; i < 20; i += 1) {
        if (i % 2) fireEvent.mouseMove(archera, { clientY: 135 }); else fireEvent.mouseMove(amazon, { clientY: 137 });
        expect(screen.getByText('Jan 2026 – Present')).toBeInTheDocument();
      }
      // A real move onto Amazon switches with no waiting.
      fireEvent.mouseMove(amazon, { clientY: 150 });
      expect(screen.getByText('Jun 2025 – Jan 2026')).toBeInTheDocument();
      // Crossing a heading inside the map keeps the current item.
      fireEvent.mouseOut(amazon, { relatedTarget: heading });
      expect(screen.queryByText(/Below are my experiences/)).toBeNull();
      // Leaving the map clears it after a short grace period.
      fireEvent.mouseOut(amazon, { relatedTarget: document.body });
      expect(screen.getByText('Jun 2025 – Jan 2026')).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(HOVER_LEAVE_MS + 5); });
      expect(screen.getByText(/Below are my experiences/)).toBeInTheDocument();
    } finally {
      spy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('has no status or date column on the rows', () => {
    renderAt('/');
    expect(screen.getByRole('button', { name: /Archera · Software Developer/ })).not.toHaveTextContent('2026');
  });
});

describe('professional page', () => {
  it('dims roles that did not use a selected skill and says where it was used', () => {
    renderAt('/professional');
    fireEvent.click(screen.getByRole('button', { name: 'SQLAlchemy' }));
    expect(screen.getByText('SQLAlchemy · Used At Archera')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /IPro Systems/ })).toHaveStyle({ opacity: '0.3' });
  });
});

describe('academic page', () => {
  it('lists only the Laplacian GLM under research, and shows degree coursework on select', () => {
    renderAt('/academic');
    expect(screen.queryByText(/Contrastive Learning for ASD/)).toBeNull();
    expect(screen.queryByText(/Alzheimer/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /M\.S\., Computer Science/ }));
    expect(screen.getByText(/Foundations of Machine Learning \(CS 5262\)/)).toBeInTheDocument();
  });
});

describe('personal page', () => {
  it('switches apps and their screenshots, with no tagline', () => {
    renderAt('/personal');
    expect(screen.queryByText(/one Olene account/)).toBeNull();
    expect(screen.queryByText(/which I own and operate/)).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /LibroCost/ }));
    expect(screen.getByAltText('LibroCost screenshot')).toHaveAttribute('src', '/images/olene/librocost.png');
    expect(screen.getByRole('tab', { name: /LibroCost/ })).toHaveTextContent('Available');
    expect(screen.getByText('Travel, soccer, League of Legends, 3D printing and electronics.')).toBeInTheDocument();
  });
});
