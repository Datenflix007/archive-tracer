/** Classification of a source, as documented in docs/sources.md. */
export type AccessMode = 'api-browser' | 'api-proxy' | 'deeplink-only' | 'manual-request';

/** What the user knows about the person they are looking for. All fields optional except a name. */
export interface PersonQuery {
  firstName: string;
  lastName: string;
  birthName: string;
  /** Additional spellings, comma separated in the UI. */
  variants: string[];
  /** Exact birth date as YYYY-MM-DD, if known. */
  birthDate: string;
  birthYear: number | null;
  /** Tolerance in years around birthYear. */
  birthYearTolerance: number;
  birthPlace: string;
  lastResidence: string;
  parents: string;
}

/** Where a piece of information came from. Every hit and every folder entry carries one. */
export interface Provenance {
  sourceId: string;
  sourceName: string;
  /** Holding institution (archive, library, memorial). */
  institution: string;
  /** Collection / fonds path, if the source provides it. */
  collection: string;
  /** Reference code / Signatur. */
  reference: string;
  url: string;
  /** ISO timestamp of retrieval. */
  retrievedAt: string;
  /** Human-readable query that produced this hit. */
  query: string;
}

export interface Hit {
  /** Stable id within the source. */
  id: string;
  sourceId: string;
  title: string;
  /** Short context line: dates, type, description. */
  details: string[];
  /** Year range as displayed, e.g. "1941–1942". */
  dateRange: string;
  provenance: Provenance;
}

export interface SourceMeta {
  id: string;
  name: string;
  /** One-sentence description of what can be found there. */
  description: string;
  access: AccessMode;
  /** Name of the key in key storage, if the API needs one. */
  keyName?: string;
  keyHelpUrl?: string;
  termsUrl?: string;
  /** Attribution the source requires us to show. */
  attribution?: string;
  /** Shown next to deep links when the search cannot be pre-filled. */
  deepLinkNote?: string;
  homepage: string;
}

export interface SearchContext {
  fetch: typeof fetch;
  signal?: AbortSignal;
  getKey: (name: string) => string | null;
  now: () => Date;
}

export interface SearchResult {
  hits: Hit[];
  /** Total hits reported by the source (may exceed hits.length). */
  total: number;
}

export interface SourceAdapter {
  meta: SourceMeta;
  /** URL that opens the source's own search, pre-filled where possible. */
  buildDeepLink(query: PersonQuery): string;
  /** Only for api-* sources. */
  search?(query: PersonQuery, ctx: SearchContext): Promise<SearchResult>;
}

export class MissingKeyError extends Error {
  constructor(public readonly keyName: string) {
    super(`API key "${keyName}" is required`);
    this.name = 'MissingKeyError';
  }
}

export class SourceHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SourceHttpError';
  }
}
