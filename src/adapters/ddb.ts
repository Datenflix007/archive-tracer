import type { Hit, PersonQuery, SearchContext, SearchResult, SourceAdapter, SourceMeta } from '../types';
import { fetchJson } from '../lib/http';
import { ddbDaysToYear, describeQuery, fullName, solrNameQuery, surnames, yearRange } from '../lib/query';

/**
 * Deutsche Digitale Bibliothek API v2 (Solr index), no key needed, CORS "*".
 * Archivportal-D is the archive sector of the DDB: filter sector_fct:sec_01.
 * See docs/sources.md §2–3.
 */
const ENDPOINT = 'https://api.deutsche-digitale-bibliothek.de/2/search/index/search/select';
const FIELDS = [
  'id',
  'label',
  'provider',
  'apd_reference_number',
  'apd_context',
  'apd_document_type',
  'begin_time',
  'end_time',
  'description',
  'sector_fct',
].join(',');
const ROWS = 50;

interface DdbDoc {
  id: string;
  label?: string[];
  provider?: string[];
  apd_reference_number?: string[];
  apd_context?: string;
  apd_document_type?: string[];
  begin_time?: number[];
  end_time?: number[];
  description?: string[];
}

export interface DdbResponse {
  response: { numFound: number; docs: DdbDoc[] };
}

type Variant = 'archive' | 'library';

const META: Record<Variant, SourceMeta> = {
  archive: {
    id: 'archivportal-d',
    name: 'Archivportal-D',
    description: 'Erschließungsangaben aus deutschen Archiven (Landes-, Staats-, Kommunalarchive, Bundesarchiv).',
    access: 'api-browser',
    homepage: 'https://www.archivportal-d.de/',
    termsUrl: 'https://www.deutsche-digitale-bibliothek.de/content/nutzungsbedingungen',
    attribution: 'Daten: Archivportal-D / Deutsche Digitale Bibliothek',
  },
  library: {
    id: 'ddb',
    name: 'Deutsche Digitale Bibliothek',
    description: 'Bibliotheken, Museen, Mediatheken und Denkmalpflege (ohne Archive, die stehen unter Archivportal-D).',
    access: 'api-browser',
    homepage: 'https://www.deutsche-digitale-bibliothek.de/',
    termsUrl: 'https://www.deutsche-digitale-bibliothek.de/content/nutzungsbedingungen',
    attribution: 'Powered by Deutsche Digitale Bibliothek',
  },
};

export function buildDdbUrl(q: PersonQuery, variant: Variant): string {
  const params = new URLSearchParams({
    q: solrNameQuery(q),
    fq: variant === 'archive' ? 'sector_fct:sec_01' : '-sector_fct:sec_01',
    rows: String(ROWS),
    fl: FIELDS,
  });
  return `${ENDPOINT}?${params}`;
}

export function parseDdb(data: DdbResponse, q: PersonQuery, variant: Variant, now: Date): SearchResult {
  const meta = META[variant];
  const portal = variant === 'archive' ? 'https://www.archivportal-d.de/item/' : 'https://www.deutsche-digitale-bibliothek.de/item/';
  const hits: Hit[] = data.response.docs.map((d) => {
    const from = d.begin_time?.[0];
    const to = d.end_time?.[0];
    const details = [d.apd_document_type?.[0], d.description?.[0]].filter((x): x is string => !!x);
    return {
      id: d.id,
      sourceId: meta.id,
      title: d.label?.[0] ?? '(ohne Titel)',
      details,
      dateRange: yearRange(from ? ddbDaysToYear(from) : undefined, to ? ddbDaysToYear(to, true) : undefined),
      provenance: {
        sourceId: meta.id,
        sourceName: meta.name,
        institution: d.provider?.[0] ?? '',
        collection: d.apd_context ?? '',
        reference: d.apd_reference_number?.[0] ?? '',
        url: portal + encodeURIComponent(d.id),
        retrievedAt: now.toISOString(),
        query: describeQuery(q),
      },
    };
  });
  return { hits, total: data.response.numFound };
}

function makeAdapter(variant: Variant): SourceAdapter {
  return {
    meta: META[variant],
    buildDeepLink(q) {
      const term = [q.firstName, surnames(q)[0] ?? ''].join(' ').trim() || fullName(q);
      return variant === 'archive'
        ? `https://www.archivportal-d.de/objekte?query=${encodeURIComponent(term)}`
        : `https://www.deutsche-digitale-bibliothek.de/searchresults?query=${encodeURIComponent(term)}`;
    },
    async search(q: PersonQuery, ctx: SearchContext) {
      const data = await fetchJson<DdbResponse>(ctx, buildDdbUrl(q, variant));
      return parseDdb(data, q, variant, ctx.now());
    },
  };
}

export const archivportalAdapter = makeAdapter('archive');
export const ddbAdapter = makeAdapter('library');
