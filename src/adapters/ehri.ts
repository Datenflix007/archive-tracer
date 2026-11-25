import type { Hit, PersonQuery, SearchContext, SearchResult, SourceAdapter } from '../types';
import { fetchJson } from '../lib/http';
import { describeQuery, surnames } from '../lib/query';

/**
 * EHRI Portal API v1 (JSON:API), no key, CORS "*". Described by EHRI as experimental.
 * See docs/sources.md §4.
 */
const API = 'https://portal.ehri-project.eu/api/v1';
const PORTAL = 'https://portal.ehri-project.eu';
const LIMIT = 50;

interface EhriDescription {
  name?: string;
  unitDates?: string[];
  scopeAndContent?: string;
  biographicalHistory?: string;
  datesOfExistence?: string;
  languageCode?: string;
}

interface EhriItem {
  id: string;
  type: string;
  attributes: {
    name?: string;
    localId?: string;
    alternateIds?: string[];
    descriptions?: EhriDescription[];
  };
  relationships?: { holder?: { data?: { id: string } } };
}

export interface EhriSearchResponse {
  data: EhriItem[];
  meta?: { total?: number };
}

export interface EhriRepositoryResponse {
  data: { id: string; attributes: { name?: string } };
}

export function ehriQueryString(q: PersonQuery): string {
  return [...surnames(q), q.firstName.trim()].filter(Boolean).join(' ');
}

export function buildEhriUrl(q: PersonQuery): string {
  const p = new URLSearchParams({ q: ehriQueryString(q), limit: String(LIMIT) });
  p.append('type', 'DocumentaryUnit');
  p.append('type', 'HistoricalAgent');
  return `${API}/search?${p}`;
}

const trim = (s: string, n = 240) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function parseEhri(
  data: EhriSearchResponse,
  q: PersonQuery,
  holderNames: Map<string, string>,
  now: Date,
): SearchResult {
  const hits: Hit[] = data.data.map((item) => {
    const desc = item.attributes.descriptions?.[0] ?? {};
    const isAgent = item.type === 'HistoricalAgent';
    const holderId = item.relationships?.holder?.data?.id ?? '';
    const details = [
      isAgent ? 'Normdatensatz (Person oder Körperschaft)' : 'Archivbeschreibung',
      desc.scopeAndContent ? trim(desc.scopeAndContent) : '',
      desc.biographicalHistory ? trim(desc.biographicalHistory) : '',
    ].filter(Boolean);
    return {
      id: item.id,
      sourceId: 'ehri',
      title: desc.name ?? item.attributes.name ?? item.id,
      details,
      dateRange: desc.unitDates?.join(', ') ?? desc.datesOfExistence ?? '',
      provenance: {
        sourceId: 'ehri',
        sourceName: 'EHRI-Portal',
        institution: holderNames.get(holderId) ?? holderId,
        collection: '',
        reference: item.attributes.alternateIds?.[0] ?? item.attributes.localId ?? '',
        url: `${PORTAL}/${isAgent ? 'authorities' : 'units'}/${encodeURIComponent(item.id)}`,
        retrievedAt: now.toISOString(),
        query: describeQuery(q),
      },
    };
  });
  return { hits, total: data.meta?.total ?? hits.length };
}

export const ehriAdapter: SourceAdapter = {
  meta: {
    id: 'ehri',
    name: 'EHRI-Portal',
    description: 'Europäische Holocaust-Forschungsinfrastruktur: Beschreibungen von Beständen in Archiven weltweit.',
    access: 'api-browser',
    homepage: 'https://portal.ehri-project.eu/',
    termsUrl: 'https://portal.ehri-project.eu/terms',
    attribution: 'Daten: European Holocaust Research Infrastructure (EHRI)',
  },
  buildDeepLink(q) {
    return `${PORTAL}/search?q=${encodeURIComponent(ehriQueryString(q))}`;
  },
  async search(q: PersonQuery, ctx: SearchContext) {
    const data = await fetchJson<EhriSearchResponse>(ctx, buildEhriUrl(q));
    // Resolve holding repositories (documented "/{ID}" action) so citations name the archive.
    const holderIds = [...new Set(data.data.map((d) => d.relationships?.holder?.data?.id).filter((x): x is string => !!x))];
    const names = new Map<string, string>();
    await Promise.all(
      holderIds.slice(0, 15).map(async (id) => {
        try {
          const r = await fetchJson<EhriRepositoryResponse>(ctx, `${API}/${encodeURIComponent(id)}`);
          if (r.data.attributes.name) names.set(id, r.data.attributes.name);
        } catch {
          /* holder name is optional; keep the id */
        }
      }),
    );
    return parseEhri(data, q, names, ctx.now());
  },
};
