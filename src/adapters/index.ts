import type { SourceAdapter } from '../types';
import { archivportalAdapter, ddbAdapter } from './ddb';
import { ehriAdapter } from './ehri';
import { europeanaAdapter } from './europeana';
import { wikidataAdapter } from './wikidata';
import { naraCatalogAdapter, naraNsdapAdapter } from './nara';
import { deepLinkAdapters } from './deeplinks';

/** Sources queried by archive-tracer itself (directly, or through the user's own proxy). */
export const apiAdapters: SourceAdapter[] = [
  archivportalAdapter,
  naraNsdapAdapter,
  naraCatalogAdapter,
  ehriAdapter,
  wikidataAdapter,
  ddbAdapter,
  europeanaAdapter,
];

/** Sources reachable only through links. */
export const linkAdapters: SourceAdapter[] = deepLinkAdapters;

export const allAdapters: SourceAdapter[] = [...apiAdapters, ...linkAdapters];

export function adapterById(id: string): SourceAdapter | undefined {
  return allAdapters.find((a) => a.meta.id === id);
}
