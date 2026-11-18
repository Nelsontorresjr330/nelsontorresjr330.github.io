import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { siteFunctionCode } from '../lib/site-stack';

type Req = { uri: string; headers: Record<string, { value: string }>; querystring: Record<string, { value: string; multiValue?: { value: string }[] }> };
type Handler = (e: { request: Req }) => any;

function load(src: string): Handler {
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\nreturn handler;`)() as Handler;
}
function req(uri: string, host = 'nelsontorres.dev', querystring: Req['querystring'] = {}): { request: Req } {
  return { request: { uri, headers: { host: { value: host } }, querystring } };
}

const site = load(siteFunctionCode('nelsontorres.dev', { '/research': '/research/laplacian-glm' }));
const api = load(fs.readFileSync(path.join(__dirname, '..', 'functions', 'api-request.js'), 'utf8'));

describe('site request function', () => {
  it('serves index.html for React routes', () => {
    expect(site(req('/research/laplacian-glm')).uri).toBe('/index.html');
    expect(site(req('/')).uri).toBe('/index.html');
  });

  it('passes files through untouched', () => {
    expect(site(req('/assets/index-abc.js')).uri).toBe('/assets/index-abc.js');
    expect(site(req('/Resume.pdf')).uri).toBe('/Resume.pdf');
  });

  it('301s other hosts to the canonical host, keeping path and query', () => {
    const res = site(req('/work', 'www.nelsontorres.dev', { a: { value: '1' }, b: { value: '' } }));
    expect(res.statusCode).toBe(301);
    expect(res.headers.location.value).toBe('https://nelsontorres.dev/work?a=1&b');
  });

  it('keeps repeated query values on redirect', () => {
    const res = site(req('/', 'abc.cloudfront.net', { t: { value: 'x', multiValue: [{ value: 'x' }, { value: 'y' }] } }));
    expect(res.headers.location.value).toBe('https://nelsontorres.dev/?t=x&t=y');
  });

  it('301s moved pages, with or without a trailing slash', () => {
    expect(site(req('/research')).headers.location.value).toBe('/research/laplacian-glm');
    expect(site(req('/research/')).headers.location.value).toBe('/research/laplacian-glm');
  });

  it('serves Storybook from its own index.html', () => {
    expect(site(req('/storybook')).headers.location.value).toBe('/storybook/');
    expect(site(req('/storybook/')).uri).toBe('/storybook/index.html');
    expect(site(req('/storybook/iframe.html')).uri).toBe('/storybook/iframe.html');
  });
});

describe('api request function', () => {
  it('strips the /api/<demo> prefix', () => {
    expect(api(req('/api/laplacian-glm/run')).uri).toBe('/run');
    expect(api(req('/api/laplacian-glm/status/abc-123')).uri).toBe('/status/abc-123');
    expect(api(req('/api/laplacian-glm')).uri).toBe('/');
  });
});

describe('site function code', () => {
  it('fills both placeholders in code, leaving none behind', () => {
    const src = siteFunctionCode('a.dev', {});
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/__CANONICAL_HOST__|__REDIRECTS__/);
  });
});
