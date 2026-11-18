import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import content from '../content/portfolio';
import NotebookConcept from './NotebookConcept';
import LabConcept from './LabConcept';
import IndexConcept from './IndexConcept';

const LAPLACIAN = /Laplacian-regularized GLM/;

describe.each([
  ['Notebook', () => <NotebookConcept content={content} />],
  ['Lab', () => <LabConcept content={content} />],
  ['Index', () => <IndexConcept content={content} />],
])('%s concept', (_name, make) => {
  it('offers the Academic, Professional and Personal sections', () => {
    render(make());
    for (const label of ['Academic', 'Professional', 'Personal']) {
      expect(screen.getAllByText(new RegExp(label)).length).toBeGreaterThan(0);
    }
  });

  it('links the Laplacian demo to its published path', () => {
    render(make());
    const link = screen.getByText(LAPLACIAN).closest('a');
    expect(link).toHaveAttribute('href', '/research/laplacian-glm');
  });

  it('shows planned projects without a link to a page that does not exist yet', () => {
    render(make());
    const planned = screen.getByText(/Graph contrastive learning on functional brain networks/);
    expect(planned.closest('a')).toBeNull();
  });
});

describe('Notebook tabs', () => {
  it('switches to the Personal projects and timeline', () => {
    render(<NotebookConcept content={content} />);
    expect(screen.queryByText('PayClear')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
    expect(screen.getByText('PayClear')).toBeInTheDocument();
    expect(screen.queryByText(LAPLACIAN)).toBeNull();
  });
});

describe('Lab filter', () => {
  it('narrows the grid to one area and shows counts', () => {
    render(<LabConcept content={content} />);
    const tabs = screen.getByRole('tablist');
    fireEvent.click(within(tabs).getByRole('tab', { name: /Personal/ }));
    expect(within(tabs).getByRole('tab', { name: /Personal/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('PayClear')).toBeInTheDocument();
    expect(screen.queryByText(LAPLACIAN)).toBeNull();
  });

  it('opens external links in a new tab', () => {
    render(<LabConcept content={content} initialFilter="personal" />);
    const link = screen.getByText('PayClear').closest('a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
