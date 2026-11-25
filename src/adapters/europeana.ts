import { MissingKeyError, type Hit, type PersonQuery, type SearchContext, type SearchResult, type SourceAdapter } from '../types';
import { fetchJson } from '../lib/http';
import { describeQuery, fullName, solrNameQuery } from '../lib/query';

/**
 * Europeana Search API. Requires a personal API key (BYOK), sent as X-Api-Key header.
 * CORS "*", preflight for x-api-key allowed. See docs/sources.md §5.
 */
const ENDPOINT = 'https://api.europeana.eu/record/v2/search.json';
export const EUROPEANA_KEY = 'europeana';

interface EuropeanaItem {
  id: string;
  title?: string[];
  dcTitleLangAware?: Record<string, string[]>;
  dcDescription?: string[];
  dataProvider?: string[];
  year?: string[];
  type?: string;
  guid?: string;
}

export interface EuropeanaResponse {
  success: boolean;
  totalResults: number;
  items?: EuropeanaItem[];
}

export function buildEuropeanaUrl(q: PersonQuery): string {
  const p = new URLSearchParams({ query: solrNameQuery(q), rows: '50', profile: 'minimal' });
  return `${ENDPOINT}?${p}`;
}

const TYPES: Record<string, string> = {
  TEXT: 'Text',
  IMAGE: 'Bild',
  SOUND: 'Ton',
  VIDEO: 'Video',
  '3D': '3D-Objekt',
};

/** Remove tracking parameters and API-key echoes from item links. */
export function cleanEuropeanaUrl(guid: string | undefined, id: string): string {
  try {
    const u = new URL(guid ?? `https://www.europeana.eu/item${id}`);
    u.search = '';
    return u.toString();
  } catch {
    return `https://www.europeana.eu/item${id}`;
  }
}

export function parseEuropeana(data: EuropeanaResponse, q: PersonQuery, now: Date): SearchResult {
  const hits: Hit[] = (data.items ?? []).map((it) => ({
    id: it.id,
    sourceId: 'europeana',
    title: it.title?.[0] ?? it.dcTitleLangAware?.def?.[0] ?? '(ohne Titel)',
    details: [it.type ? (TYPES[it.type] ?? it.type) : '', it.dcDescription?.[0] ?? ''].filter(Boolean),
    dateRange: it.year?.[0] ?? '',
    provenance: {
      sourceId: 'europeana',
      sourceName: 'Europeana',
      institution: it.dataProvider?.[0] ?? '',
      collection: '',
      reference: it.id,
      url: cleanEuropeanaUrl(it.guid, it.id),
      retrievedAt: now.toISOString(),
      query: describeQuery(q),
    },
  }));
  return { hits, total: data.totalResults };
}

export const europeanaAdapter: SourceAdapter = {
  meta: {
    id: 'europeana',
    name: 'Europeana',
    description: 'Digitalisierte Bestände europäischer Archive, Bibliotheken und Museen.',
    access: 'api-browser',
    keyName: EUROPEANA_KEY,
    keyHelpUrl: 'https://pro.europeana.eu/page/get-api',
    homepage: 'https://www.europeana.eu/de',
    termsUrl: 'https://www.europeana.eu/de/rights/terms-of-use',
    attribution: 'Daten: Europeana',
  },
  buildDeepLink(q) {
    return `https://www.europeana.eu/de/search?query=${encodeURIComponent(fullName(q))}`;
  },
  async search(q: PersonQuery, ctx: SearchContext) {
    const key = ctx.getKey(EUROPEANA_KEY);
    if (!key) throw new MissingKeyError(EUROPEANA_KEY);
    const data = await fetchJson<EuropeanaResponse>(ctx, buildEuropeanaUrl(q), { headers: { 'X-Api-Key': key } });
    return parseEuropeana(data, q, ctx.now());
  },
};
