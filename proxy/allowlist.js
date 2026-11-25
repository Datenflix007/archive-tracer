/**
 * The only upstream targets this proxy will ever contact.
 * Everything else is rejected. Keep this list short and documented (docs/proxy.md).
 */
export const ALLOWED_TARGETS = [
  {
    // NARA open dataset: A3340 NSDAP membership card index (roll JSON files).
    host: 'nara-nsdap.s3.us-east-2.amazonaws.com',
    pathPattern: /^\/A3340-(MFKL|MFOK)\/A3340-(MFKL|MFOK)-[A-Z0-9]+\/\d+\.json$/,
    forwardApiKey: false,
  },
  {
    // NARA Catalog API v2, read-only search. The user's own key is forwarded.
    host: 'catalog.archives.gov',
    pathPattern: /^\/api\/v2\/records\/search$/,
    forwardApiKey: true,
  },
];

/**
 * @param {string | null} raw target URL from the ?url= parameter
 * @returns {{ ok: true, url: string, forwardApiKey: boolean } | { ok: false, reason: string }}
 */
export function checkTarget(raw) {
  if (!raw) return { ok: false, reason: 'missing url parameter' };
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid url' };
  }
  if (u.protocol !== 'https:') return { ok: false, reason: 'https only' };
  if (u.username || u.password || u.port) return { ok: false, reason: 'credentials or port not allowed' };
  const rule = ALLOWED_TARGETS.find((r) => r.host === u.hostname.toLowerCase());
  if (!rule) return { ok: false, reason: 'host not allowed' };
  if (!rule.pathPattern.test(u.pathname)) return { ok: false, reason: 'path not allowed' };
  u.hash = '';
  return { ok: true, url: u.toString(), forwardApiKey: rule.forwardApiKey };
}

/**
 * @param {string} origin value of the Origin request header
 * @param {string | undefined} configured comma-separated list from env.ALLOWED_ORIGINS
 */
export function isOriginAllowed(origin, configured) {
  const list = (configured ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return !!origin && list.includes(origin);
}
