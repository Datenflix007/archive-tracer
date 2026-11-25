import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PersonQuery, SearchContext } from '../src/types';
import { MissingKeyError, MissingProxyError } from '../src/types';
import { emptyQuery } from '../src/lib/query';
import {
  catalogUrl,
  normalizeRollKey,
  normalizeText,
  parseManifest,
  parseRollDocument,
  rollJsonUrl,
  searchFrames,
  selectRolls,
} from '../src/lib/nsdap';
import {
  buildNaraQuery,
  extractNaraHits,
  naraCatalogAdapter,
  naraNsdapAdapter,
  parseNara,
  resetManifestCache,
} from '../src/adapters/nara';
import { entryFromHit } from '../src/lib/folder';

const fixture = (name: string): unknown => JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));
const NOW = new Date('2026-11-25T12:00:00Z');
const q = (over: Partial<PersonQuery> = {}): PersonQuery => ({ ...emptyQuery(), firstName: 'Paul', lastName: 'Schultze', ...over });
const rolls = parseManifest(fixture('nsdap-manifest.json'));
const r0014 = rolls.find((r) => r.collection === 'MFKL' && r.box === 'R0014')!;

describe('A3340 manifest and roll selection', () => {
  it('parses manifest entries and ranges', () => {
    expect(r0014.naid).toBe('593495034');
    expect(r0014.rangeStart).toBe('Schultze, Paul');
    expect(r0014.rangeEnd).toBe('Schultze, Robert');
  });

  it('folds accents, ß and tz like NARA Trace', () => {
    expect(normalizeRollKey('Schultze, Paul')).toBe('schulze paul');
    expect(normalizeRollKey('Strauß')).toBe('strauss');
    expect(normalizeText('Müller')).toBe(normalizeText('Mueller'));
  });

  it('selects the roll for surname + first name, with neighbours', () => {
    const boxes = selectRolls(rolls, 'Schultze', 'Paul', ['MFKL']).map((r) => r.box);
    expect(boxes).toContain('R0014');
    expect(boxes.length).toBeLessThanOrEqual(3);
  });

  it('without first name loads only the first rolls of the surname', () => {
    const boxes = selectRolls(rolls, 'Schulze', '', ['MFKL']).map((r) => r.box);
    expect(boxes[0]).toBe('R0011');
    expect(boxes.length).toBeLessThanOrEqual(4);
  });

  it('never selects more than a bounded number of rolls', () => {
    expect(selectRolls(rolls, 'Zzz', 'A').length).toBeLessThanOrEqual(6);
    expect(selectRolls(rolls, '', 'A')).toEqual([]);
  });

  it('builds S3 and catalog URLs and rejects foreign paths', () => {
    expect(rollJsonUrl(r0014)).toBe(
      'https://nara-nsdap.s3.us-east-2.amazonaws.com/A3340-MFKL/A3340-MFKL-R0014/593495034.json',
    );
    expect(() => rollJsonUrl({ ...r0014, s3Path: 's3://other-bucket/x' })).toThrow();
    expect(catalogUrl('593495034', 10)).toBe('https://catalog.archives.gov/id/593495034?objectPage=10');
  });
});

describe('A3340 frame search (recorded roll R0014, trimmed)', () => {
  const frames = parseRollDocument(fixture('nsdap-roll-R0014.json'), r0014);

  it('numbers frames by position', () => {
    expect(frames[9]!.frameNumber).toBe(10);
    expect(frames[9]!.objectFilename).toBe('A3340-MFKL-R0014-00010.tif');
  });

  it('finds cards with surname and first name, best first', () => {
    const m = searchFrames(frames, ['Schultze'], 'Paul');
    expect(m.length).toBeGreaterThan(3);
    expect(m[0]!.firstNameFound).toBe(true);
    expect(m[0]!.excerpt.toLowerCase()).toContain('schultze');
  });

  it('matches spelling variants via the same normalisation', () => {
    expect(searchFrames(frames, ['Schulze'], 'Paul').length).toBe(searchFrames(frames, ['Schultze'], 'Paul').length);
  });

  it('finds a membership number even when OCR splits it', () => {
    const m = searchFrames(frames, ['Nichtvorhanden'], '', '5 363 968');
    expect(m.some((x) => x.membershipNumberFound && x.frame.frameNumber === 80)).toBe(true);
  });

  it('does not match substrings of other names', () => {
    expect(searchFrames(frames, ['Schul'], '')).toEqual([]);
  });
});

function ctx(responses: Record<string, unknown>, opts: Partial<SearchContext> = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const key = Object.keys(responses).find((k) => url.includes(k));
    return key ? new Response(JSON.stringify(responses[key])) : new Response('not found', { status: 404 });
  });
  return { fetch: fetchMock as unknown as typeof fetch, getKey: () => null, now: () => NOW, ...opts } as SearchContext & {
    fetch: typeof fetchMock;
  };
}

describe('NARA A3340 adapter', () => {
  it('without proxy returns candidate rolls with catalog links', async () => {
    resetManifestCache();
    const c = ctx({ 'nsdap.json': fixture('nsdap-manifest.json') });
    const res = await naraNsdapAdapter.search!(q(), c);
    expect(res.notice).toMatch(/Ohne eigenen Proxy/);
    expect(res.hits.some((h) => h.provenance.url === 'https://catalog.archives.gov/id/593495034')).toBe(true);
    expect(c.fetch).toHaveBeenCalledTimes(1);
  });

  it('with proxy downloads only the selected rolls and returns frame hits', async () => {
    resetManifestCache();
    const c = ctx(
      { 'nsdap.json': fixture('nsdap-manifest.json'), '593495034.json': fixture('nsdap-roll-R0014.json') },
      { proxyUrl: 'https://proxy.example' },
    );
    const res = await naraNsdapAdapter.search!(q(), c);
    const calls = c.fetch.mock.calls.map(([u]) => String(u));
    expect(calls.filter((u) => u.startsWith('https://proxy.example/?url=')).length).toBeLessThanOrEqual(6);
    const frameHit = res.hits.find((h) => h.provenance.url.includes('objectPage='))!;
    expect(frameHit.provenance.institution).toContain('NARA');
    expect(frameHit.details.join(' ')).toContain('OCR-Auszug (maschinell erkannt, ungeprüft)');
    // Rolls that failed (404 in this mock) are still listed, not silently dropped.
    expect(res.notice).toMatch(/Nicht ladbar/);
  });
});

describe('NARA Catalog adapter', () => {
  it('builds an OR query like NARA Trace', () => {
    expect(buildNaraQuery(q({ birthName: 'Meier', membershipNumber: '1.234.567' }))).toBe(
      'Paul Schultze OR Schultze OR Paul Meier OR Meier OR 1234567',
    );
  });

  it('requires proxy and key', async () => {
    await expect(naraCatalogAdapter.search!(q(), ctx({}))).rejects.toBeInstanceOf(MissingProxyError);
    await expect(naraCatalogAdapter.search!(q(), ctx({}, { proxyUrl: 'https://p.example' }))).rejects.toBeInstanceOf(
      MissingKeyError,
    );
  });

  it('sends the key as header via the proxy', async () => {
    const c = ctx({ 'records%2Fsearch': { body: { hits: { total: { value: 0 }, hits: [] } } } }, {
      proxyUrl: 'https://p.example',
      getKey: () => 'k',
    });
    await naraCatalogAdapter.search!(q(), c);
    const [url, init] = c.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith('https://p.example/?url=https%3A%2F%2Fcatalog.archives.gov%2Fapi%2Fv2%2Frecords%2Fsearch')).toBe(true);
    expect(url).not.toContain('k&');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('k');
  });

  // Constructed response in the Elasticsearch-like shape that NARA Trace's parser handles
  // (no recorded fixture: recording requires a personal NARA key).
  const constructed = {
    body: {
      hits: {
        total: { value: 1234 },
        hits: [
          {
            _source: {
              record: {
                naId: 12044361,
                title: 'Records Relating to Membership in the NSDAP',
                levelOfDescription: 'series',
                ancestors: [{ title: 'Record Group 242' }],
                digitalObjects: [{}, {}],
              },
            },
          },
        ],
      },
    },
  };

  it('extracts records and total from the response', () => {
    const { records, total } = extractNaraHits(constructed);
    expect(total).toBe(1234);
    expect(records[0]!.naId).toBe(12044361);
    expect(extractNaraHits({ records: [{ naId: 1, title: 'x' }] }).records).toHaveLength(1);
  });

  it('marks hits as link-only and the folder stores no NARA content', () => {
    const res = parseNara(constructed, q(), NOW);
    const hit = res.hits[0]!;
    expect(hit.storage).toBe('link-only');
    expect(hit.provenance.url).toBe('https://catalog.archives.gov/id/12044361');
    const entry = entryFromHit(hit, q(), NOW);
    expect(entry.title).not.toContain('NSDAP');
    expect(entry.details).toEqual([]);
    expect(entry.provenance.collection).toBe('');
    expect(entry.citation).toContain('NAID 12044361');
  });
});
