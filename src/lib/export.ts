import { FOLDER_FORMAT, FOLDER_VERSION, type FolderEntry, type FolderExport } from './folder';
import { formatDate } from './citation';

export function toJson(entries: FolderEntry[], now = new Date()): string {
  const doc: FolderExport = {
    format: FOLDER_FORMAT,
    version: FOLDER_VERSION,
    exportedAt: now.toISOString(),
    entries,
  };
  return JSON.stringify(doc, null, 2);
}

const CSV_COLUMNS: [string, (e: FolderEntry) => string][] = [
  ['Person', (e) => e.personLabel],
  ['Titel', (e) => e.title],
  ['Zeitraum', (e) => e.dateRange],
  ['Institution', (e) => e.provenance.institution],
  ['Bestand', (e) => e.provenance.collection],
  ['Signatur', (e) => e.provenance.reference],
  ['Quelle', (e) => e.provenance.sourceName],
  ['URL', (e) => e.provenance.url],
  ['Abgerufen', (e) => formatDate(e.provenance.retrievedAt)],
  ['Suchanfrage', (e) => e.provenance.query],
  ['Art', (e) => (e.kind === 'api' ? 'aus Schnittstelle' : 'manuell übernommen')],
  ['Zitiervorschlag', (e) => e.citation],
  ['Notiz', (e) => e.note],
];

export function csvCell(v: string): string {
  // Guard against formula injection in spreadsheet software.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const BOM = String.fromCharCode(0xfeff);

/** CSV with semicolon separator and BOM, so it opens correctly in German Excel/LibreOffice. */
export function toCsv(entries: FolderEntry[]): string {
  const rows = [CSV_COLUMNS.map(([h]) => h), ...entries.map((e) => CSV_COLUMNS.map(([, f]) => f(e)))];
  return BOM + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

function gedLine(level: number, tag: string, value = ''): string[] {
  // GEDCOM 5.5.1: lines max. 255 chars; split long values with CONC.
  const clean = value.replace(/[\r\n]+/g, ' ').replace(/@/g, '@@');
  const max = 200;
  const out = [`${level} ${tag}${clean ? ' ' + clean.slice(0, max) : ''}`];
  for (let i = max; i < clean.length; i += max) out.push(`${level + 1} CONC ${clean.slice(i, i + max)}`);
  return out;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function gedDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * GEDCOM 5.5.1 export: one INDI per searched person exactly as the user entered it
 * (no automatic merging), one SOUR per folder entry. Findings are exported as sources,
 * not as asserted facts.
 */
export function toGedcom(entries: FolderEntry[], now = new Date()): string {
  const lines: string[] = [
    '0 HEAD',
    '1 SOUR archive-tracer',
    '2 NAME archive-tracer',
    `1 DATE ${gedDate(now.toISOString())}`,
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
  ];
  const persons = new Map<string, FolderEntry[]>();
  for (const e of entries) {
    const p = e.person;
    const key = JSON.stringify([p.firstName, p.lastName, p.birthName, p.birthDate, p.birthYear]);
    persons.set(key, [...(persons.get(key) ?? []), e]);
  }
  const sourceIds = new Map<string, string>();
  entries.forEach((e, i) => sourceIds.set(e.id, `@S${i + 1}@`));

  let n = 0;
  for (const group of persons.values()) {
    const p = group[0]!.person;
    lines.push(`0 @I${++n}@ INDI`);
    lines.push(...gedLine(1, 'NAME', `${p.firstName} /${p.lastName}/`.trim()));
    if (p.birthName) {
      lines.push(...gedLine(1, 'NAME', `${p.firstName} /${p.birthName}/`.trim()));
      lines.push('2 TYPE birth');
    }
    if (p.birthDate || p.birthYear || p.birthPlace) {
      lines.push('1 BIRT');
      if (p.birthDate) lines.push(`2 DATE ${gedDate(p.birthDate)}`);
      else if (p.birthYear) lines.push(`2 DATE ABT ${p.birthYear}`);
      if (p.birthPlace) lines.push(...gedLine(2, 'PLAC', p.birthPlace));
    }
    lines.push(
      ...gedLine(
        1,
        'NOTE',
        'Angaben zur Person wie bei der Suche eingegeben (archive-tracer). Die verknüpften Quellen sind Fundstellen; ob sie diese Person betreffen, muss geprüft werden.',
      ),
    );
    for (const e of group) {
      lines.push(`1 SOUR ${sourceIds.get(e.id)}`);
      if (e.note) lines.push(...gedLine(2, 'NOTE', e.note));
    }
  }
  for (const e of entries) {
    lines.push(`0 ${sourceIds.get(e.id)} SOUR`);
    lines.push(...gedLine(1, 'TITL', e.title));
    if (e.provenance.institution) lines.push(...gedLine(1, 'AUTH', e.provenance.institution));
    lines.push(...gedLine(1, 'PUBL', e.provenance.sourceName));
    if (e.provenance.reference) lines.push(...gedLine(1, 'REFN', e.provenance.reference));
    lines.push(...gedLine(1, 'NOTE', e.citation));
    if (e.provenance.url) lines.push(...gedLine(1, 'WWW', e.provenance.url));
  }
  lines.push('0 TRLR');
  return lines.join('\r\n') + '\r\n';
}
