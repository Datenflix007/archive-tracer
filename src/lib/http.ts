import { SourceHttpError, type SearchContext } from '../types';

const TIMEOUT_MS = 20_000;

/** Fetch JSON with timeout; throws SourceHttpError on non-2xx. */
export async function fetchJson<T>(ctx: SearchContext, url: string, init: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const signal = ctx.signal ? AbortSignal.any([ctx.signal, timeout]) : timeout;
  const res = await ctx.fetch(url, { ...init, signal });
  if (!res.ok) {
    throw new SourceHttpError(res.status, `HTTP ${res.status}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // e.g. NARA answers with an HTML page when the key is rejected
    throw new SourceHttpError(res.status, 'keine gültige Datenantwort (JSON)');
  }
}
