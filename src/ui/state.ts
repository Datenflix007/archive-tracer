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
