import type { Provenance } from '../types';

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Citation suggestion following common German archival practice:
 * Institution, Bestand, Signatur, „Titel“, URL (abgerufen am …).
 */
export function citation(title: string, p: Provenance): string {
  const parts: string[] = [];
  if (p.institution) parts.push(p.institution);
  if (p.collection) parts.push(p.collection);
  if (p.reference) parts.push(p.reference);
  if (title) parts.push(`„${title}“`);
  let out = parts.join(', ');
  const via = p.sourceName && p.sourceName !== p.institution ? `, nachgewiesen über ${p.sourceName}` : '';
  if (p.url) out += `${out ? '. ' : ''}Online: ${p.url}${via} (abgerufen am ${formatDate(p.retrievedAt)})`;
  return `${out}.`;
}
