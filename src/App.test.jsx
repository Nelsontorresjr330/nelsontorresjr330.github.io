import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppShell, ROUTES } from './App';

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
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Archera · Software Developer/ }));
    expect(panel.querySelector('.pointer-fine\\:line-clamp-4')).not.toBeNull();
  });

  it('goes straight from one row to the next without flashing back to the instructions', () => {
    // Regression (2026-11-18): each row cleared the hover when the cursor left it, so between two
    // rows, or over a section heading, the panel showed the instructions and every row lit up.
    renderAt('/');
    const archera = screen.getByRole('button', { name: /Archera · Software Developer/ });
    const heading = screen.getAllByText('ACADEMIC').find((el) => el.tagName === 'P');
    fireEvent.mouseOver(archera);
    expect(screen.getByText('Jan 2026 – Present')).toBeInTheDocument();
    // The cursor moves off the row onto a heading that is still inside the map.
    fireEvent.mouseOut(archera, { relatedTarget: heading });
    expect(screen.queryByText(/Below are my experiences/)).toBeNull();
    expect(screen.getByText('Jan 2026 – Present')).toBeInTheDocument();
    // Then onto the next row: straight to its details.
    const amazon = screen.getByRole('button', { name: /Amazon · Senior Software Engineer/ });
    fireEvent.mouseOut(heading, { relatedTarget: amazon });
    expect(screen.getByText('Jun 2025 – Jan 2026')).toBeInTheDocument();
    // Leaving the whole map (to outside the page) clears it.
    fireEvent.mouseOut(amazon, { relatedTarget: document.body });
    expect(screen.getByText(/Below are my experiences/)).toBeInTheDocument();
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
