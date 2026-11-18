import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const json = (status, body) => ({ status, ok: status < 400, json: async () => body });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Laplacian demo page', () => {
  it('recovers from a cold-start 500 on Run instead of showing an error', async () => {
    vi.stubEnv('REACT_APP_GLM_API_URL', 'https://api.example/glm');
    const fetchMock = vi.fn((url, opts) => {
      if (opts?.method === 'POST') {
        return Promise.resolve(fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST').length === 1
          ? json(500, { message: 'Internal Server Error' })
          : json(200, { jobId: 'job-1', ready: false }));
      }
      return new Promise(() => {}); // status polling: never resolves in this test
    });
    vi.stubGlobal('fetch', fetchMock);
    const { default: LaplacianGLMPage } = await import('./LaplacianGLMPage');

    render(<LaplacianGLMPage />);
    fireEvent.click(screen.getByRole('button', { name: /Run Simulation/i }));

    await waitFor(() => expect(screen.getByText(/Computing metrics and rendering/)).toBeInTheDocument(), { timeout: 4000 });
    const posts = fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0][0]).toBe('https://api.example/glm/run');
    expect(screen.queryByText(/Internal Server Error|HTTP 500/)).toBeNull();
  });
});
