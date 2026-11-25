import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkTarget, isOriginAllowed } from '../proxy/allowlist.js';
import worker from '../proxy/worker.js';

const ORIGINS = 'https://datenflix007.github.io,http://localhost:5173';
const env = { ALLOWED_ORIGINS: ORIGINS };
const S3 = 'https://nara-nsdap.s3.us-east-2.amazonaws.com/A3340-MFKL/A3340-MFKL-R0014/593495034.json';
const req = (target: string | null, init: RequestInit & { origin?: string } = {}) => {
  const url = new URL('https://proxy.example/');
  if (target !== null) url.searchParams.set('url', target);
  const headers = new Headers(init.headers);
  headers.set('Origin', init.origin ?? 'https://datenflix007.github.io');
  return new Request(url, { ...init, headers });
};

afterEach(() => vi.unstubAllGlobals());

describe('allowlist', () => {
  it('accepts only the documented NARA targets', () => {
    expect(checkTarget(S3)).toMatchObject({ ok: true, forwardApiKey: false });
    expect(checkTarget('https://catalog.archives.gov/api/v2/records/search?q=x')).toMatchObject({ ok: true, forwardApiKey: true });
  });

  it.each([
    ['http://nara-nsdap.s3.us-east-2.amazonaws.com/A3340-MFKL/A3340-MFKL-R0014/1.json', 'https only'],
    ['https://evil.example/A3340-MFKL/A3340-MFKL-R0014/1.json', 'host not allowed'],
    ['https://nara-nsdap.s3.us-east-2.amazonaws.com/other/file.json', 'path not allowed'],
    ['https://nara-nsdap.s3.us-east-2.amazonaws.com/A3340-MFKL/../secret.json', 'path not allowed'],
    ['https://catalog.archives.gov/api/v2/tags', 'path not allowed'],
    ['https://user:pw@catalog.archives.gov/api/v2/records/search', 'credentials or port not allowed'],
    ['https://catalog.archives.gov:8443/api/v2/records/search', 'credentials or port not allowed'],
    ['not a url', 'invalid url'],
  ])('rejects %s', (url, reason) => {
    expect(checkTarget(url)).toEqual({ ok: false, reason });
  });

  it('checks origins exactly', () => {
    expect(isOriginAllowed('https://datenflix007.github.io', ORIGINS)).toBe(true);
    expect(isOriginAllowed('https://datenflix007.github.io.evil.example', ORIGINS)).toBe(false);
    expect(isOriginAllowed('', ORIGINS)).toBe(false);
    expect(isOriginAllowed('https://x.example', undefined)).toBe(false);
  });
});

describe('worker', () => {
  it('answers health checks', async () => {
    const res = await worker.fetch(new Request('https://proxy.example/health', { headers: { Origin: 'https://datenflix007.github.io' } }), env);
    expect(await res.json()).toMatchObject({ ok: true, service: 'archive-tracer-proxy', originAllowed: true });
  });

  it('rejects foreign origins and non-GET methods', async () => {
    expect((await worker.fetch(req(S3, { origin: 'https://evil.example' }), env)).status).toBe(403);
    expect((await worker.fetch(req(S3, { method: 'POST' }), env)).status).toBe(405);
    expect((await worker.fetch(req('https://evil.example/x'), env)).status).toBe(400);
  });

  it('forwards to S3 without the API key and adds CORS + no-store', async () => {
    const upstream = vi.fn(async () => new Response('{"ok":1}', { headers: { 'Content-Type': 'binary/octet-stream' } }));
    vi.stubGlobal('fetch', upstream);
    const res = await worker.fetch(req(S3, { headers: { 'x-api-key': 'secret' } }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://datenflix007.github.io');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const [, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get('x-api-key')).toBeNull();
    expect(init.redirect).toBe('manual');
  });

  it('forwards the API key only to the NARA catalog', async () => {
    const upstream = vi.fn(async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', upstream);
    await worker.fetch(req('https://catalog.archives.gov/api/v2/records/search?q=x', { headers: { 'x-api-key': 'secret' } }), env);
    const [, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get('x-api-key')).toBe('secret');
  });

  it('refuses upstream redirects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 302, headers: { Location: 'https://evil.example' } })));
    expect((await worker.fetch(req(S3), env)).status).toBe(502);
  });
});
