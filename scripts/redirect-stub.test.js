import { describe, expect, it } from 'vitest';
import { redirectStubHtml, redirectTarget } from './redirect-stub';

function runStub(html, location) {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  let replaced = null;
  const fakeWindow = { location: { ...location, replace: (u) => { replaced = u; } } };
  // eslint-disable-next-line no-new-func
  new Function('window', script)(fakeWindow);
  return replaced;
}

describe('GitHub Pages redirect stub', () => {
  it('keeps the path, query and hash of links already shared', () => {
    const html = redirectStubHtml('nelsontorres.dev');
    expect(runStub(html, { pathname: '/research/laplacian-glm', search: '?k=1000', hash: '#results' }))
      .toBe('https://nelsontorres.dev/research/laplacian-glm?k=1000#results');
    expect(runStub(html, { pathname: '/', search: '', hash: '' })).toBe('https://nelsontorres.dev/');
  });

  it('marks the new domain canonical and works without JavaScript', () => {
    const html = redirectStubHtml('nelsontorres.dev');
    expect(html).toContain('<link rel="canonical" href="https://nelsontorres.dev/">');
    expect(html).toContain('http-equiv="refresh" content="0; url=https://nelsontorres.dev/"');
  });

  it('refuses something that is not a domain', () => {
    expect(() => redirectStubHtml('"><script>')).toThrow();
  });

  it('builds the target URL from location parts', () => {
    expect(redirectTarget('a.dev', { pathname: '/work' })).toBe('https://a.dev/work');
  });
});
