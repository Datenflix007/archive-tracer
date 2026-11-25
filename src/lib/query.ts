import type { PersonQuery } from '../types';

export function emptyQuery(): PersonQuery {
  return {
    firstName: '',
    lastName: '',
    birthName: '',
    variants: [],
    birthDate: '',
    birthYear: null,
    birthYearTolerance: 2,
    birthPlace: '',
    lastResidence: '',
    parents: '',
    membershipNumber: '',
  };
}

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

/** All surnames to search for: last name, birth name, variants (deduplicated, case-insensitive). */
export function surnames(q: PersonQuery): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [q.lastName, q.birthName, ...q.variants]) {
    const s = clean(raw);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}

export function fullName(q: PersonQuery): string {
  return clean(`${q.firstName} ${q.lastName}`);
}

/** Short human-readable description of the query, stored as provenance. */
export function describeQuery(q: PersonQuery): string {
  const parts = [fullName(q) || '(ohne Namen)'];
  if (clean(q.birthName)) parts.push(`geb. ${clean(q.birthName)}`);
  if (q.variants.length) parts.push(`Varianten: ${q.variants.join(', ')}`);
  if (q.birthDate) parts.push(`* ${q.birthDate}`);
  else if (q.birthYear) parts.push(`* ${q.birthYear} ±${q.birthYearTolerance}`);
  if (clean(q.birthPlace)) parts.push(`Geburtsort: ${clean(q.birthPlace)}`);
  if (clean(q.lastResidence)) parts.push(`letzter Wohnort: ${clean(q.lastResidence)}`);
  if (clean(q.membershipNumber ?? '')) parts.push(`Mitgliedsnummer: ${clean(q.membershipNumber)}`);
  return parts.join('; ');
}

export function hasName(q: PersonQuery): boolean {
  return surnames(q).length > 0;
}

/** Escape a term for Solr / Lucene query syntax and wrap multi-word terms in quotes. */
export function solrTerm(term: string): string {
  const escaped = clean(term).replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, '\\$1');
  return /\s/.test(escaped) ? `"${escaped}"` : escaped;
}

/** Solr query: (surname1 OR surname2 ...) AND firstName */
export function solrNameQuery(q: PersonQuery): string {
  const names = surnames(q).map(solrTerm);
  const surnamePart = names.length > 1 ? `(${names.join(' OR ')})` : (names[0] ?? '');
  const first = clean(q.firstName);
  return first ? `${surnamePart} AND ${solrTerm(first)}` : surnamePart;
}

/** Convert days since 0000-01-01 (DDB begin_time/end_time) to a year. */
export function ddbDaysToYear(days: number, isEnd = false): number {
  return Math.floor((isEnd ? days - 1 : days) / 365.2425) + 1;
}

export function yearRange(from?: number, to?: number): string {
  if (!from && !to) return '';
  if (from && to && from !== to) return `${from}–${to}`;
  return String(from ?? to);
}
