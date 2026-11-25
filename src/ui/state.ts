import type { PersonQuery } from '../types';
import { emptyQuery } from '../lib/query';

/** In-memory app state for the current tab. The query is kept in sessionStorage only. */
const QUERY_KEY = 'archive-tracer:query';

export function loadQuery(): PersonQuery {
  try {
    const raw = sessionStorage.getItem(QUERY_KEY);
    if (raw) return { ...emptyQuery(), ...(JSON.parse(raw) as Partial<PersonQuery>) };
  } catch {
    /* ignore */
  }
  return emptyQuery();
}

export function saveQuery(q: PersonQuery): void {
  try {
    sessionStorage.setItem(QUERY_KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

/** Search options for this tab. */
export interface SearchOptions {
  /** Include the NSDAP membership card index (A3340); downloads several MB per search via the proxy. */
  nsdap: boolean;
}
const OPTIONS_KEY = 'archive-tracer:options';

export function loadOptions(): SearchOptions {
  try {
    const raw = sessionStorage.getItem(OPTIONS_KEY);
    if (raw) return { nsdap: true, ...(JSON.parse(raw) as Partial<SearchOptions>) };
  } catch {
    /* ignore */
  }
  return { nsdap: true };
}

export function saveOptions(o: SearchOptions): void {
  try {
    sessionStorage.setItem(OPTIONS_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}
