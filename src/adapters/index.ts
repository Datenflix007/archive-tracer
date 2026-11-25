import type { SourceAdapter } from '../types';
import { archivportalAdapter, ddbAdapter } from './ddb';
import { ehriAdapter } from './ehri';
import { europeanaAdapter } from './europeana';
import { wikidataAdapter } from './wikidata';
import { deepLinkAdapters, naraAdapter } from './deeplinks';

/** Sources queried directly from the browser. */
export const apiAdapters: SourceAdapter[] = [archivportalAdapter, ehriAdapter, wikidataAdapter, ddbAdapter, europeanaAdapter];

/** Sources reachable only through links (incl. api-proxy sources until the proxy exists). */
export const linkAdapters: SourceAdapter[] = [...deepLinkAdapters, naraAdapter];

export const allAdapters: SourceAdapter[] = [...apiAdapters, ...linkAdapters];

export function adapterById(id: string): SourceAdapter | undefined {
  return allAdapters.find((a) => a.meta.id === id);
}
