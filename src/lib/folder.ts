import type { Hit, PersonQuery, Provenance } from '../types';
import { citation } from './citation';
import { fullName } from './query';

/** One saved finding in the research folder ("Recherchemappe"). */
export interface FolderEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Person this finding was saved for (the user's search, not a merged identity). */
  person: PersonQuery;
  personLabel: string;
  /** "api": taken from an API response; "manual": entered by the user from a deep-link source. */
  kind: 'api' | 'manual';
  title: string;
  details: string[];
  dateRange: string;
  provenance: Provenance;
  citation: string;
  /** The user's own notes. Never generated automatically. */
  note: string;
}

export const FOLDER_FORMAT = 'archive-tracer-folder';
export const FOLDER_VERSION = 1;

export interface FolderExport {
  format: typeof FOLDER_FORMAT;
  version: number;
  exportedAt: string;
  entries: FolderEntry[];
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function entryFromHit(hit: Hit, person: PersonQuery, now = new Date()): FolderEntry {
  const ts = now.toISOString();
  if (hit.storage === 'link-only') {
    // NARA Catalog API terms: "Please do not cache or store any content returned by the API."
    // Keep only identifier, link, retrieval date and query; the user adds their own notes.
    const provenance = { ...hit.provenance, collection: '' };
    const title = `Datensatz im ${hit.provenance.sourceName} (${hit.provenance.reference})`;
    return {
      id: newId(),
      createdAt: ts,
      updatedAt: ts,
      person,
      personLabel: fullName(person) || 'Ohne Namen',
      kind: 'api',
      title,
      details: [],
      dateRange: '',
      provenance,
      citation: citation('', provenance),
      note: '',
    };
  }
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    person,
    personLabel: fullName(person) || 'Ohne Namen',
    kind: 'api',
    title: hit.title,
    details: hit.details,
    dateRange: hit.dateRange,
    provenance: hit.provenance,
    citation: citation(hit.title, hit.provenance),
    note: '',
  };
}

export interface ManualInput {
  title: string;
  dateRange: string;
  note: string;
  provenance: Omit<Provenance, 'retrievedAt'> & { retrievedAt?: string };
}

export function manualEntry(input: ManualInput, person: PersonQuery, now = new Date()): FolderEntry {
  const ts = now.toISOString();
  const provenance: Provenance = { ...input.provenance, retrievedAt: input.provenance.retrievedAt || ts };
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    person,
    personLabel: fullName(person) || 'Ohne Namen',
    kind: 'manual',
    title: input.title,
    details: [],
    dateRange: input.dateRange,
    provenance,
    citation: citation(input.title, provenance),
    note: input.note,
  };
}

/** Validate an imported JSON document. Returns entries or throws with a German message. */
export function parseFolderImport(json: unknown): FolderEntry[] {
  const doc = json as Partial<FolderExport>;
  if (!doc || doc.format !== FOLDER_FORMAT || !Array.isArray(doc.entries)) {
    throw new Error('Die Datei ist keine archive-tracer-Recherchemappe.');
  }
  if ((doc.version ?? 0) > FOLDER_VERSION) {
    throw new Error('Die Mappe stammt aus einer neueren Version von archive-tracer.');
  }
  return doc.entries.filter(
    (e): e is FolderEntry =>
      !!e &&
      typeof e.id === 'string' &&
      typeof e.title === 'string' &&
      !!e.provenance &&
      typeof e.provenance.url === 'string',
  );
}
