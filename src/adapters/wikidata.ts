import type { Hit, PersonQuery, SearchContext, SearchResult, SourceAdapter } from '../types';
import { fetchJson } from '../lib/http';
import { describeQuery, fullName, surnames } from '../lib/query';

/**
 * Wikidata Query Service (SPARQL), no key, CORS "*".
 * Finds people (Q5) and Stolpersteine (Q26703203) via full-text search.
 * Endpoint is configurable because WDQS v1 is being phased out (see docs/sources.md §6).
 */
export const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const HUMAN = 'http://www.wikidata.org/entity/Q5';
const STOLPERSTEIN = 'http://www.wikidata.org/entity/Q26703203';
const API_USER_AGENT = 'archive-tracer/0.1 (https://github.com/Datenflix007/archive-tracer)';

type Binding = Record<string, { value: string } | undefined>;
export interface SparqlResponse {
  results: { bindings: Binding[] };
}

/** CirrusSearch expression: ("First Last" OR "First Birthname") haswbstatement:P31=Q5|P31=Q26703203 */
export function wikidataSearchExpression(q: PersonQuery): string {
  const strip = (s: string) => s.replace(/["\\]/g, '').trim();
  const first = strip(q.firstName);
  const phrases = surnames(q).map((s) => `"${[first, strip(s)].filter(Boolean).join(' ')}"`);
  const names = phrases.length > 1 ? `(${phrases.join(' OR ')})` : (phrases[0] ?? '');
  return `${names} haswbstatement:P31=Q5|P31=Q26703203`;
}

const sparqlString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

export function buildWikidataQuery(q: PersonQuery): string {
  return `SELECT ?item ?itemLabel ?itemDescription ?type ?birth ?death ?birthPlaceLabel ?deathPlaceLabel ?address WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:endpoint "www.wikidata.org"; wikibase:api "Search";
      mwapi:srsearch ${sparqlString(wikidataSearchExpression(q))}; mwapi:srlimit "50".
    ?item wikibase:apiOutputItem mwapi:title.
  }
  ?item wdt:P31 ?type . VALUES ?type { wd:Q5 wd:Q26703203 }
  OPTIONAL { ?item wdt:P569 ?birth } OPTIONAL { ?item wdt:P570 ?death }
  OPTIONAL { ?item wdt:P19 ?birthPlace } OPTIONAL { ?item wdt:P20 ?deathPlace }
  OPTIONAL { ?item wdt:P6375 ?address }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
} LIMIT 200`;
}

const year = (iso?: string) => (iso ? /^-?\d{1,4}/.exec(iso.replace(/^\+/, ''))?.[0] : undefined);
const date = (iso?: string) => (iso ? iso.slice(0, 10) : '');

export function parseWikidata(data: SparqlResponse, q: PersonQuery, now: Date): SearchResult {
  // One row per combination of optional values: group by item.
  const byItem = new Map<string, Binding[]>();
  for (const b of data.results.bindings) {
    const id = b.item?.value;
    if (id) byItem.set(id, [...(byItem.get(id) ?? []), b]);
  }
  const hits: Hit[] = [];
  for (const [uri, rows] of byItem) {
    const qid = uri.split('/').pop() ?? uri;
    const first = rows[0]!;
    const isStone = rows.some((r) => r.type?.value === STOLPERSTEIN);
    const isHuman = rows.some((r) => r.type?.value === HUMAN);
    const uniq = (k: string) => [...new Set(rows.map((r) => r[k]?.value).filter((v): v is string => !!v))];
    const details: string[] = [];
    if (first.itemDescription?.value) details.push(first.itemDescription.value);
    if (isHuman) {
      const b = uniq('birth')[0];
      const d = uniq('death')[0];
      const bp = uniq('birthPlaceLabel').join(' / ');
      const dp = uniq('deathPlaceLabel').join(' / ');
      if (b || bp) details.push(`geboren ${[date(b), bp && `in ${bp}`].filter(Boolean).join(' ')}`);
      if (d || dp) details.push(`gestorben ${[date(d), dp && `in ${dp}`].filter(Boolean).join(' ')}`);
    }
    if (isStone) {
      const addr = uniq('address');
      if (addr.length) details.push(`Adresse: ${addr.join(' / ')}`);
    }
    const b = year(uniq('birth')[0]);
    const d = year(uniq('death')[0]);
    hits.push({
      id: qid,
      sourceId: 'wikidata',
      title: first.itemLabel?.value ?? qid,
      details: [isStone ? 'Stolperstein' : 'Person', ...details],
      dateRange: b || d ? `${b ?? '?'}–${d ?? '?'}` : '',
      provenance: {
        sourceId: 'wikidata',
        sourceName: 'Wikidata',
        institution: 'Wikidata',
        collection: '',
        reference: qid,
        url: `https://www.wikidata.org/wiki/${qid}`,
        retrievedAt: now.toISOString(),
        query: describeQuery(q),
      },
    });
  }
  return { hits, total: hits.length };
}

export function makeWikidataAdapter(endpoint = WIKIDATA_ENDPOINT): SourceAdapter {
  return {
    meta: {
      id: 'wikidata',
      name: 'Wikidata (Personen und Stolpersteine)',
      description: 'Freie Wissensdatenbank; enthält Personendaten und über 55.000 Stolpersteine.',
      access: 'api-browser',
      homepage: 'https://www.wikidata.org/',
      termsUrl: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',
      attribution: 'Daten: Wikidata (CC0)',
    },
    buildDeepLink(q) {
      return `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(fullName(q))}`;
    },
    async search(q: PersonQuery, ctx: SearchContext) {
      const url = `${endpoint}?${new URLSearchParams({ query: buildWikidataQuery(q), format: 'json' })}`;
      const data = await fetchJson<SparqlResponse>(ctx, url, {
        headers: { Accept: 'application/sparql-results+json', 'Api-User-Agent': API_USER_AGENT },
      });
      return parseWikidata(data, q, ctx.now());
    },
  };
}

export const wikidataAdapter = makeWikidataAdapter();
