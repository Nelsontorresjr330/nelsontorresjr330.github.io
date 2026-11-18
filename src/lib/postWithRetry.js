// POST that retries once on a server error or a network failure.
//
// Why: the Laplacian demo's Lambda is a 4 GB container image. After it has been idle, the
// first POST /run can come back as API Gateway's 500 while the container cold-starts
// (seen 2026-11-18); the same request a moment later succeeds. Client errors (4xx) are
// never retried: they mean the input was wrong.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function postWithRetry(url, body, { retries = 1, delayMs = 1500, fetchImpl = fetch } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status < 500 || attempt === retries) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
    }
    await sleep(delayMs);
  }
  throw lastError;
}
