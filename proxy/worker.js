/**
 * archive-tracer proxy — a minimal Cloudflare Worker that each user deploys themselves.
 *
 * - Forwards GET requests only to the hosts/paths in allowlist.js (NARA).
 * - Only accepts requests from the origins in env.ALLOWED_ORIGINS.
 * - Stores nothing, logs nothing, caches nothing (no console.*, no KV, Cache-Control: no-store).
 * - Forwards the NARA API key header only to catalog.archives.gov.
 */
import { checkTarget, isOriginAllowed } from './allowlist.js';

const VERSION = '0.1.0';
const USER_AGENT = `archive-tracer-proxy/${VERSION} (+https://github.com/Datenflix007/archive-tracer)`;

function corsHeaders(origin, allowed) {
  const h = new Headers({
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'x-api-key, accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  if (allowed) h.set('Access-Control-Allow-Origin', origin);
  return h;
}

function json(status, body, headers) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  /**
   * @param {Request} request
   * @param {{ ALLOWED_ORIGINS?: string }} env
   */
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = isOriginAllowed(origin, env.ALLOWED_ORIGINS);
    const headers = corsHeaders(origin, allowed);
    const reqUrl = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: allowed ? 204 : 403, headers });
    }
    if (request.method !== 'GET') {
      return json(405, { error: 'method not allowed' }, headers);
    }
    if (reqUrl.pathname === '/health') {
      return json(200, { ok: true, service: 'archive-tracer-proxy', version: VERSION, originAllowed: allowed }, headers);
    }
    if (!allowed) {
      return json(403, { error: 'origin not allowed' }, headers);
    }

    const target = checkTarget(reqUrl.searchParams.get('url'));
    if (!target.ok) {
      return json(400, { error: target.reason }, headers);
    }

    const upstreamHeaders = new Headers({
      Accept: request.headers.get('Accept') ?? 'application/json',
      'User-Agent': USER_AGENT,
    });
    if (target.forwardApiKey) {
      const key = request.headers.get('x-api-key');
      if (key) upstreamHeaders.set('x-api-key', key);
    }

    let upstream;
    try {
      // redirect: "manual" — never follow a redirect to a host outside the allowlist.
      upstream = await fetch(target.url, { method: 'GET', headers: upstreamHeaders, redirect: 'manual' });
    } catch {
      return json(502, { error: 'upstream not reachable' }, headers);
    }
    if (upstream.status >= 300 && upstream.status < 400) {
      return json(502, { error: 'upstream redirect refused' }, headers);
    }

    headers.set('Content-Type', upstream.headers.get('Content-Type') ?? 'application/octet-stream');
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
