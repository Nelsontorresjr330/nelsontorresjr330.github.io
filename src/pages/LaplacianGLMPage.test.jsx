import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SAVED_RESULTS } from '../content/laplacian';

const json = (status, body) => ({ status, ok: status < 400, json: async () => body });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load() {
  const { default: Page } = await import('./LaplacianGLMPage');
  render(<MemoryRouter><Page /></MemoryRouter>);
}

describe('Laplacian demo page', () => {
  it('shows the saved search-optimal run before anyone presses Run', async () => {
    vi.stubEnv('REACT_APP_GLM_API_URL', 'https://api.example/glm');
    await load();
    expect(screen.getByText('+21.0%')).toBeInTheDocument();
    expect(screen.getByAltText(/listening: OLS above/)).toHaveAttribute('src', '/research/laplacian-glm/spm-auditory-listening.png');
  });

  it('recovers from a cold-start 500 on Run instead of showing an error', async () => {
    vi.stubEnv('REACT_APP_GLM_API_URL', 'https://api.example/glm');
    let posts = 0;
    const fetchMock = vi.fn((url, opts) => {
      if (opts?.method === 'POST') { posts += 1; return Promise.resolve(posts === 1 ? json(500, { message: 'Internal Server Error' }) : json(200, { jobId: 'job-1' })); }
      return new Promise(() => {});
    });
    vi.stubGlobal('fetch', fetchMock);
    await load();
    fireEvent.click(screen.getByRole('button', { name: 'Run on AWS Lambda' }));
    await waitFor(() => expect(screen.getByText(/Computing metrics and rendering/)).toBeInTheDocument(), { timeout: 4000 });
    expect(posts).toBe(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example/glm/run');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('replaces the saved results with the finished run', async () => {
    vi.stubEnv('REACT_APP_GLM_API_URL', 'https://api.example/glm');
    const fresh = { ...SAVED_RESULTS, combined: 0.1234 };
    vi.stubGlobal('fetch', vi.fn((url, opts) => Promise.resolve(opts?.method === 'POST' ? json(200, { jobId: 'j' }) : json(200, { ready: true, results: fresh, images: {} }))));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await load();
    fireEvent.click(screen.getByRole('button', { name: 'Run on AWS Lambda' }));
    await vi.advanceTimersByTimeAsync(3100);
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByText('+12.3%')).toBeInTheDocument());
    expect(screen.getByText('Results below are from your run.')).toBeInTheDocument();
  });

  it('refuses an invalid p-value without calling the API', async () => {
    vi.stubEnv('REACT_APP_GLM_API_URL', 'https://api.example/glm');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await load();
    fireEvent.change(screen.getByLabelText('p-value'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run on AWS Lambda' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/between 0 and 1/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
