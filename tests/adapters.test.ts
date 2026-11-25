import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PersonQuery, SearchContext } from '../src/types';
import { MissingKeyError } from '../src/types';
import { emptyQuery } from '../src/lib/query';
import { archivportalAdapter, buildDdbUrl, ddbAdapter, parseDdb, type DdbResponse } from '../src/adapters/ddb';
import { buildEhriUrl, ehriAdapter, parseEhri, type EhriSearchResponse } from '../src/adapters/ehri';
import { cleanEuropeanaUrl, europeanaAdapter, parseEuropeana, type EuropeanaResponse } from '../src/adapters/europeana';
import { buildWikidataQuery, parseWikidata, wikidataSearchExpression, type SparqlResponse } from '../src/adapters/wikidata';
import { allAdapters, linkAdapters } from '../src/adapters';

const fixture = <T>(name: string): T => JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8')) as T;
const NOW = new Date('2026-11-25T12:00:00Z');
const q = (over: Partial<PersonQuery> = {}): PersonQuery => ({ ...emptyQuery(), firstName: 'Ryfka', lastName: 'Goldberg', ...over });

function ctxFor(body: unknown, keys: Record<string, string> = {}): SearchContext & { fetch: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  return { fetch: fetchMock as unknown as typeof fetch, getKey: (k: string) => keys[k] ?? null, now: () => NOW } as never;
}

describe('DDB / Archivportal-D', () => {
  it('builds a Solr query with sector filter', () => {
    const url = new URL(buildDdbUrl(q({ birthName: 'Rosen' }), 'archive'));
    expect(url.searchParams.get('q')).toBe('(Goldberg OR Rosen) AND Ryfka');
    expect(url.searchParams.get('fq')).toBe('sector_fct:sec_01');
    expect(new URL(buildDdbUrl(q(), 'library')).searchParams.get('fq')).toBe('-sector_fct:sec_01');
  });

  it('parses archive hits with full provenance', () => {
    const res = parseDdb(fixture<DdbResponse>('ddb-archive.json'), q(), 'archive', NOW);
    const hit = res.hits[0]!;
    expect(hit.title).toBe('Goldberg, Ryfka');
    expect(hit.dateRange).toBe('1941–1942');
    expect(hit.provenance.institution).toBe('Brandenburgisches Landeshauptarchiv');
    expect(hit.provenance.reference).toBe('36A');
    expect(hit.provenance.collection).toContain('Vermögensverwertungsstelle');
    expect(hit.provenance.url).toBe('https://www.archivportal-d.de/item/5RKNVA6HENTFH6PUKVO33L2QWE42M7EV');
    expect(hit.provenance.retrievedAt).toBe(NOW.toISOString());
    expect(hit.provenance.query).toContain('Ryfka Goldberg');
  });

  it('converts single-year DDB dates', () => {
    const res = parseDdb(fixture<DdbResponse>('ddb-other.json'), q(), 'library', NOW);
    expect(res.hits[0]!.dateRange).toBe('1937');
    expect(res.hits[0]!.provenance.url).toContain('deutsche-digitale-bibliothek.de/item/');
  });

  it('search() calls the API via injected fetch', async () => {
    const ctx = ctxFor(fixture('ddb-archive.json'));
    const res = await archivportalAdapter.search!(q(), ctx);
    expect(ctx.fetch).toHaveBeenCalledOnce();
    expect(res.total).toBeGreaterThan(0);
    expect(ddbAdapter.buildDeepLink(q())).toBe('https://www.deutsche-digitale-bibliothek.de/searchresults?query=Ryfka%20Goldberg');
  });
});

describe('EHRI', () => {
  it('builds search URL with both types', () => {
    const url = new URL(buildEhriUrl(q({ firstName: 'Chaya' })));
    expect(url.searchParams.get('q')).toBe('Goldberg Chaya');
    expect(url.searchParams.getAll('type')).toEqual(['DocumentaryUnit', 'HistoricalAgent']);
  });

  it('parses JSON:API documents and resolves holder names', () => {
    const data = fixture<EhriSearchResponse>('ehri.json');
    const res = parseEhri(data, q(), new Map([['fr-002374', 'Archives nationales']]), NOW);
    const hit = res.hits[0]!;
    expect(hit.title).toBe('Goldberg Chaya - Goldberg Sura');
    expect(hit.provenance.institution).toBe('Archives nationales');
    expect(hit.provenance.reference).toBe('MIC/F/9/5695/4');
    expect(hit.provenance.url).toBe('https://portal.ehri-project.eu/units/fr-002374-mic_f_9_5605_mic_f_9_5788-d_4-92');
    expect(res.total).toBe(4);
  });

  it('tolerates failing holder lookups', async () => {
    let call = 0;
    const ctx = {
      fetch: vi.fn(async () =>
        call++ === 0 ? new Response(JSON.stringify(fixture('ehri.json'))) : new Response('nope', { status: 500 }),
      ),
      getKey: () => null,
      now: () => NOW,
    } as unknown as SearchContext;
    const res = await ehriAdapter.search!(q(), ctx);
    expect(res.hits[0]!.provenance.institution).toBe('fr-002374');
  });
});

describe('Europeana', () => {
  it('requires a user key', async () => {
    await expect(europeanaAdapter.search!(q(), ctxFor({}))).rejects.toBeInstanceOf(MissingKeyError);
  });

  it('sends the key as header, not in the URL', async () => {
    const ctx = ctxFor(fixture('europeana.json'), { europeana: 'secret' });
    await europeanaAdapter.search!(q(), ctx);
    const [url, init] = ctx.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('secret');
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('secret');
  });

  it('parses items and strips tracking parameters', () => {
    const res = parseEuropeana(fixture<EuropeanaResponse>('europeana.json'), q(), NOW);
    expect(res.total).toBe(2151);
    const hit = res.hits[0]!;
    expect(hit.provenance.institution).toContain('Royal Library');
    expect(hit.provenance.url).toBe('https://www.europeana.eu/item/92023/images_billed_2010_okt_billeder_object6002');
    expect(cleanEuropeanaUrl(undefined, '/1/x')).toBe('https://www.europeana.eu/item/1/x');
  });
});

describe('Wikidata', () => {
  it('builds a phrase search over name variants', () => {
    expect(wikidataSearchExpression(q({ birthName: 'Rosen' }))).toBe(
      '("Ryfka Goldberg" OR "Ryfka Rosen") haswbstatement:P31=Q5|P31=Q26703203',
    );
  });

  it('escapes quotes so user input cannot break the SPARQL string', () => {
    const sparql = buildWikidataQuery(q({ lastName: 'Gold"} ; DROP' }));
    expect(sparql).toContain('mwapi:srsearch "\\"Ryfka Gold} ; DROP\\" haswbstatement');
  });

  it('groups rows per item and labels Stolpersteine', () => {
    const res = parseWikidata(fixture<SparqlResponse>('wikidata-stolpersteine.json'), q(), NOW);
    const stone = res.hits.find((h) => h.id === 'Q44162578')!;
    expect(stone.title).toBe('Stolperstein für Margarete Goldberg');
    expect(stone.details[0]).toBe('Stolperstein');
    expect(stone.details.join(' ')).toContain('Bamberger Str. 27');
    expect(new Set(res.hits.map((h) => h.id)).size).toBe(res.hits.length);
  });

  it('parses people with life dates', () => {
    const res = parseWikidata(fixture<SparqlResponse>('wikidata.json'), q(), NOW);
    const anne = res.hits.find((h) => h.id === 'Q4583')!;
    expect(anne.dateRange).toBe('1929–1945');
    expect(anne.details.join(' ')).toContain('KZ Bergen-Belsen');
    expect(anne.provenance.url).toBe('https://www.wikidata.org/wiki/Q4583');
  });
});

describe('deep links', () => {
  it('every source has a unique id and an https deep link', () => {
    const ids = allAdapters.map((a) => a.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of allAdapters) expect(a.buildDeepLink(q())).toMatch(/^https:\/\//);
  });

  it('link-only sources never expose a search() implementation', () => {
    for (const a of linkAdapters) expect(a.search).toBeUndefined();
  });

  it('encodes names in deep links', () => {
    const arolsen = linkAdapters.find((a) => a.meta.id === 'arolsen')!;
    expect(arolsen.buildDeepLink(q({ firstName: 'Józef', lastName: 'Łódź & Co' }))).toBe(
      'https://collections.arolsen-archives.org/en/search?s=J%C3%B3zef%20%C5%81%C3%B3d%C5%BA%20%26%20Co',
    );
  });
});
