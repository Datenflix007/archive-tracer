import { describe, expect, it } from 'vitest';
import { citation } from '../src/lib/citation';
import { entryFromHit, manualEntry, parseFolderImport } from '../src/lib/folder';
import { csvCell, gedDate, toCsv, toGedcom, toJson } from '../src/lib/export';
import { ddbDaysToYear, describeQuery, emptyQuery, solrNameQuery, solrTerm, surnames } from '../src/lib/query';
import type { Hit, PersonQuery } from '../src/types';

const NOW = new Date('2026-11-25T12:00:00Z');
const person: PersonQuery = { ...emptyQuery(), firstName: 'Ryfka', lastName: 'Goldberg', birthName: 'Rosen', birthYear: 1901 };
const hit: Hit = {
  id: 'X',
  sourceId: 'archivportal-d',
  title: 'Goldberg, Ryfka',
  details: [],
  dateRange: '1941–1942',
  provenance: {
    sourceId: 'archivportal-d',
    sourceName: 'Archivportal-D',
    institution: 'Brandenburgisches Landeshauptarchiv',
    collection: 'Rep. 36A Oberfinanzpräsident Berlin-Brandenburg',
    reference: '36A',
    url: 'https://www.archivportal-d.de/item/X',
    retrievedAt: NOW.toISOString(),
    query: 'Ryfka Goldberg',
  },
};

describe('query helpers', () => {
  it('deduplicates surnames case-insensitively', () => {
    expect(surnames({ ...person, variants: ['goldberg', 'Goldenberg'] })).toEqual(['Goldberg', 'Rosen', 'Goldenberg']);
  });
  it('escapes Solr syntax', () => {
    expect(solrTerm('a:b')).toBe('a\\:b');
    expect(solrTerm('van der Berg')).toBe('"van der Berg"');
    expect(solrNameQuery({ ...emptyQuery(), lastName: 'Cohn' })).toBe('Cohn');
  });
  it('converts DDB day counts', () => {
    expect(ddbDaysToYear(708572)).toBe(1941);
    expect(ddbDaysToYear(709301, true)).toBe(1942);
  });
  it('describes the query for provenance', () => {
    expect(describeQuery(person)).toBe('Ryfka Goldberg; geb. Rosen; * 1901 ±2');
  });
});

describe('citation', () => {
  it('contains institution, collection, reference, title, url and retrieval date', () => {
    expect(citation(hit.title, hit.provenance)).toBe(
      'Brandenburgisches Landeshauptarchiv, Rep. 36A Oberfinanzpräsident Berlin-Brandenburg, 36A, „Goldberg, Ryfka“. Online: https://www.archivportal-d.de/item/X, nachgewiesen über Archivportal-D (abgerufen am 25.11.2026).',
    );
  });
});

describe('folder', () => {
  it('creates entries from hits with citation and empty note', () => {
    const e = entryFromHit(hit, person, NOW);
    expect(e.kind).toBe('api');
    expect(e.note).toBe('');
    expect(e.citation).toContain('abgerufen am 25.11.2026');
    expect(e.personLabel).toBe('Ryfka Goldberg');
  });

  it('creates manual entries and fills retrieval date', () => {
    const e = manualEntry(
      {
        title: 'Gedenkblatt',
        dateRange: '',
        note: 'von Tante ausgefüllt',
        provenance: { sourceId: 'yadvashem', sourceName: 'Yad Vashem', institution: 'Yad Vashem', collection: '', reference: '123', url: 'https://example.org', query: 'x' },
      },
      person,
      NOW,
    );
    expect(e.kind).toBe('manual');
    expect(e.provenance.retrievedAt).toBe(NOW.toISOString());
  });

  it('round-trips through JSON export/import', () => {
    const entries = [entryFromHit(hit, person, NOW)];
    expect(parseFolderImport(JSON.parse(toJson(entries, NOW)))).toEqual(entries);
  });

  it('rejects foreign JSON', () => {
    expect(() => parseFolderImport({ foo: 1 })).toThrow(/keine archive-tracer/);
  });
});

describe('exports', () => {
  it('CSV uses semicolons, BOM and neutralises formulas', () => {
    const csv = toCsv([entryFromHit(hit, person, NOW)]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split('\r\n')[0]).toContain('Person;Titel;Zeitraum');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('a;b')).toBe('"a;b"');
  });

  it('GEDCOM has header, person, source and trailer', () => {
    const ged = toGedcom([entryFromHit(hit, person, NOW)], NOW);
    const lines = ged.split('\r\n');
    expect(lines[0]).toBe('0 HEAD');
    expect(ged).toContain('1 NAME Ryfka /Goldberg/');
    expect(ged).toContain('1 NAME Ryfka /Rosen/');
    expect(ged).toContain('2 DATE ABT 1901');
    expect(ged).toContain('0 @S1@ SOUR');
    expect(ged).toContain('1 WWW https://www.archivportal-d.de/item/X');
    expect(lines.at(-2)).toBe('0 TRLR');
    expect(lines.every((l) => l.length <= 255)).toBe(true);
    expect(gedDate('1901-03-07')).toBe('7 MAR 1901');
  });
});
