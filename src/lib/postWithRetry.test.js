import { describe, expect, it, vi } from 'vitest';
import { postWithRetry } from './postWithRetry';

const res = (status, body = {}) => ({ status, ok: status < 400, json: async () => body });

describe('postWithRetry', () => {
  it('retries once after a cold-start 500 and returns the second response', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(res(500)).mockResolvedValueOnce(res(200, { jobId: 'abc' }));
    const out = await postWithRetry('/run', { lambda: 2.66 }, { delayMs: 0, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(out.status).toBe(200);
    expect(await out.json()).toEqual({ jobId: 'abc' });
  });

  it('sends the body as JSON with a POST', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200));
    await postWithRetry('/run', { k: 1000 }, { delayMs: 0, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('/run', expect.objectContaining({ method: 'POST', body: '{"k":1000}' }));
  });

  it('does not retry a client error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(400));
    const out = await postWithRetry('/run', {}, { delayMs: 0, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(out.status).toBe(400);
  });

  it('returns the last 5xx when the retry also fails, so the page can show it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(502));
    const out = await postWithRetry('/run', {}, { delayMs: 0, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(out.status).toBe(502);
  });

  it('retries a network failure once, then gives up', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(postWithRetry('/run', {}, { delayMs: 0, fetchImpl })).rejects.toThrow('Failed to fetch');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
