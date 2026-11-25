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
  return (await res.json()) as T;
}
