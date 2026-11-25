/**
 * URL of the user's own proxy (Cloudflare Worker from /proxy, see docs/proxy.md).
 * Not a secret, but still only stored in this browser.
 */
const KEY = 'archive-tracer:proxy-url';

export function getProxyUrl(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setProxyUrl(url: string): void {
  try {
    const v = url.trim().replace(/\/+$/, '');
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Validate user input: must be an https URL (http only for localhost during development). */
export function isValidProxyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname));
  } catch {
    return false;
  }
}

export function viaProxy(proxyUrl: string, target: string): string {
  return `${proxyUrl}/?url=${encodeURIComponent(target)}`;
}
