import {
  MissingKeyError,
  MissingProxyError,
  type Hit,
  type PersonQuery,
  type SearchContext,
  type SearchResult,
  type SourceAdapter,
} from '../types';
import { fetchJson } from '../lib/http';
import { viaProxy } from '../lib/proxy';
import { describeQuery, fullName, surnames } from '../lib/query';
import {
  COLLECTION_LABEL,
  MANIFEST_URL,
  catalogUrl,
  parseManifest,
  parseRollDocument,
  rollJsonUrl,
  searchFrames,
  selectRolls,
  type Frame,
  type Roll,
} from '../lib/nsdap';

const NARA = 'National Archives and Records Administration (NARA)';
export const NARA_ATTRIBUTION =
  'This product uses the National Archives Catalog API but is not endorsed or certified by the National Archives and Records Administration.';
export const NARA_KEY = 'nara';

/* ------------------------------------------------------------------ */
/* A3340 NSDAP card index (open dataset)                               */
/* ------------------------------------------------------------------ */

const MAX_FRAME_HITS = 60;
let manifestCache: Promise<Roll[]> | null = null;

/** Manifest is public on GitHub (CORS "*"); kept in memory for this tab only. */
export function loadManifest(ctx: SearchContext): Promise<Roll[]> {
  manifestCache ??= fetchJson<unknown>(ctx, MANIFEST_URL)
    .then(parseManifest)
    .catch((e: unknown) => {
      manifestCache = null;
      throw e;
    });
  return manifestCache;
}

export function resetManifestCache(): void {
  manifestCache = null;
}

function rollHit(roll: Roll, q: PersonQuery, now: Date): Hit {
  return {
    id: `roll-${roll.naid}`,
    sourceId: 'nara-a3340',
    title: `${COLLECTION_LABEL[roll.collection]}, Rolle ${roll.box}: ${roll.title.replace(' - ', ' – ')}`,
    details: [
      'Der gesuchte Nachname fällt alphabetisch in diese Mikrofilmrolle. Im NARA-Katalog lassen sich die Karten Bild für Bild durchsehen.',
    ],
    dateRange: '1927–1945',
    provenance: {
      sourceId: 'nara-a3340',
      sourceName: 'NARA A3340 (NSDAP-Mitgliederkartei)',
      institution: NARA,
      collection: `RG 242, A3340, ${roll.collection} ${roll.box}`,
      reference: `NAID ${roll.naid}`,
      url: catalogUrl(roll.naid),
      retrievedAt: now.toISOString(),
      query: describeQuery(q),
    },
  };
}

function frameHit(
  frame: Frame,
  info: { firstNameFound: boolean; membershipNumberFound: boolean; excerpt: string },
  q: PersonQuery,
  now: Date,
): Hit {
  const r = frame.roll;
  const found = [
    info.membershipNumberFound ? 'Mitgliedsnummer im OCR-Text gefunden' : null,
    info.firstNameFound ? 'Vor- und Nachname im OCR-Text gefunden' : 'nur der Nachname im OCR-Text gefunden',
  ].filter((x): x is string => !!x);
  return {
    id: `${r.naid}-${frame.frameNumber}`,
    sourceId: 'nara-a3340',
    title: `${COLLECTION_LABEL[r.collection]}, Rolle ${r.box}, Bild ${frame.frameNumber}`,
    details: [...found, `OCR-Auszug (maschinell erkannt, ungeprüft): „${info.excerpt}“`],
    dateRange: '',
    provenance: {
      sourceId: 'nara-a3340',
      sourceName: 'NARA A3340 (NSDAP-Mitgliederkartei)',
      institution: NARA,
      collection: `RG 242, A3340, ${r.collection} ${r.box} (${r.title})`,
      reference: [frame.objectFilename, frame.objectId ? `Objekt-NAID ${frame.objectId}` : null].filter(Boolean).join(', '),
      url: catalogUrl(r.naid, frame.frameNumber),
      retrievedAt: now.toISOString(),
      query: describeQuery(q),
    },
  };
}

export const naraNsdapAdapter: SourceAdapter = {
  meta: {
    id: 'nara-a3340',
    name: 'NARA – NSDAP-Mitgliederkartei (A3340)',
    description:
      'Zentral- und Ortsgruppenkartei der NSDAP (RG 242, Mikrofilm A3340), von NARA als offener Datensatz veröffentlicht. Mit eigenem Proxy wird der OCR-Text der Karten durchsucht.',
    access: 'api-proxy',
    homepage: 'https://catalog.archives.gov/id/12044361',
    termsUrl: 'https://github.com/usnationalarchives/nsdap',
    attribution: 'Daten: U.S. National Archives, Open Dataset „nara-nsdap“ (Registry of Open Data on AWS)',
  },
  buildDeepLink: () => 'https://catalog.archives.gov/id/12044361',
  async search(q: PersonQuery, ctx: SearchContext): Promise<SearchResult> {
    const names = surnames(q);
    const rolls = await loadManifest(ctx);
    const now = ctx.now();
    // Rolls for the primary surname (+ variants), deduplicated.
    const selected: Roll[] = [];
    for (const s of names.slice(0, 3)) {
      for (const r of selectRolls(rolls, s, q.firstName)) if (!selected.some((x) => x.naid === r.naid)) selected.push(r);
    }
    const proxy = ctx.proxyUrl;
    const firstNameHint = q.firstName.trim()
      ? ''
      : ' Ohne Vornamen werden nur die ersten Rollen dieses Nachnamens berücksichtigt. Mit Vornamen wird die passende Rolle genauer bestimmt.';
    if (!proxy) {
      return {
        hits: selected.map((r) => rollHit(r, q, now)),
        total: selected.length,
        notice:
          'Ohne eigenen Proxy zeigt archive-tracer nur die Mikrofilmrollen, in die der Name alphabetisch fällt. NARA stellt die Kartendaten ohne Browser-Freigabe (CORS) bereit. Mit einem eigenen Proxy (siehe Einstellungen) wird der Text jeder Karte automatisch durchsucht.' + firstNameHint,
      };
    }
    const frames: Frame[] = [];
    const failed: Roll[] = [];
    // Max. 3 parallel downloads (each roll JSON is ~2–3 MB).
    for (let i = 0; i < selected.length; i += 3) {
      const batch = selected.slice(i, i + 3);
      const results = await Promise.all(
        batch.map(async (roll) => {
          try {
            return parseRollDocument(await fetchJson<unknown>(ctx, viaProxy(proxy, rollJsonUrl(roll))), roll);
          } catch (e) {
            if (ctx.signal?.aborted) throw e;
            failed.push(roll);
            return [];
          }
        }),
      );
      results.forEach((f) => frames.push(...f));
    }
    const matches = searchFrames(frames, names, q.firstName, q.membershipNumber);
    const hits = matches.slice(0, MAX_FRAME_HITS).map((m) => frameHit(m.frame, m, q, now));
    // Rolls that could not be loaded are still shown so nothing silently disappears.
    hits.push(...failed.map((r) => rollHit(r, q, now)));
    const searched = selected.filter((r) => !failed.includes(r)).map((r) => `${r.collection} ${r.box}`);
    return {
      hits,
      total: matches.length + failed.length,
      notice: `${matches.filter((m) => m.firstNameFound).length} Karten mit Vor- und Nachname, ${matches.length} mit dem Nachnamen (sortiert: beste Übereinstimmung zuerst). Durchsucht: ${searched.join(', ') || 'keine Rolle'} (${frames.length} Kartenbilder).${failed.length ? ` Nicht ladbar: ${failed.map((r) => `${r.collection} ${r.box}`).join(', ')}.` : ''} Der Text stammt aus NARAs automatischer Texterkennung und enthält Fehler. Prüfen Sie jede Karte am Bild.${firstNameHint}`,
    };
  },
};

/* ------------------------------------------------------------------ */
/* NARA Catalog API v2 (whole catalog, BYOK + proxy)                   */
/* ------------------------------------------------------------------ */

const CATALOG_API = 'https://catalog.archives.gov/api/v2/records/search';

interface NaraRecord {
  naId?: number | string;
  title?: string;
  description?: string;
  localIdentifier?: string;
  levelOfDescription?: string;
  recordGroupNumber?: number | string;
  ancestors?: { title?: string; levelOfDescription?: string; naId?: number | string }[];
  digitalObjects?: unknown[];
}

const sanitize = (s: string) => s.replace(/"/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

/** Same strategy as NARA Trace: deduplicated terms joined with OR, max. 1024 chars. */
export function buildNaraQuery(q: PersonQuery): string {
  const terms: string[] = [];
  for (const s of surnames(q)) terms.push(fullName({ ...q, lastName: s }), s);
  const num = (q.membershipNumber ?? '').replace(/\D+/g, '');
  if (num) terms.push(num);
  const seen = new Set<string>();
  let query = '';
  for (const t of terms.map(sanitize)) {
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    const next = query ? `${query} OR ${t}` : t;
    if (next.length > 1024) break;
    query = next;
  }
  return query;
}

export function buildNaraUrl(q: PersonQuery): string {
  return `${CATALOG_API}?${new URLSearchParams({ q: buildNaraQuery(q), limit: '50', page: '1' })}`;
}

/** NARA responses have varied in shape; same tolerant extraction as NARA Trace. */
export function extractNaraHits(data: unknown): { records: NaraRecord[]; total: number | null } {
  const get = (obj: unknown, path: string[]): unknown =>
    path.reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), obj);
  let hits: unknown[] = [];
  for (const p of [['body', 'hits', 'hits'], ['hits', 'hits'], ['body', 'hits'], ['records'], ['results']]) {
    const v = get(data, p);
    if (Array.isArray(v)) {
      hits = v;
      break;
    }
  }
  const records = hits
    .map((h) => {
      const src = get(h, ['_source']);
      return (get(src, ['record']) ?? src ?? get(h, ['record']) ?? h) as NaraRecord;
    })
    .filter((r) => r && (r.naId !== undefined || r.title));
  let total: number | null = null;
  for (const c of [get(data, ['total']), get(data, ['body', 'hits', 'total']), get(data, ['hits', 'total'])]) {
    if (typeof c === 'number') total = c;
    else if (c && typeof (c as { value?: unknown }).value === 'number') total = (c as { value: number }).value;
    if (total !== null) break;
  }
  return { records, total };
}

export function parseNara(data: unknown, q: PersonQuery, now: Date): SearchResult {
  const { records, total } = extractNaraHits(data);
  const hits: Hit[] = records.map((r) => {
    const naid = String(r.naId ?? '');
    const path = (r.ancestors ?? [])
      .filter((a) => a.title)
      .map((a) => a.title!)
      .join(' › ');
    return {
      id: naid,
      sourceId: 'nara',
      title: r.title ?? `NAID ${naid}`,
      details: [
        r.levelOfDescription ?? '',
        r.digitalObjects?.length ? `${r.digitalObjects.length} Digitalisat(e)` : '',
        r.description ? (r.description.length > 240 ? r.description.slice(0, 239) + '…' : r.description) : '',
      ].filter(Boolean),
      dateRange: '',
      storage: 'link-only',
      provenance: {
        sourceId: 'nara',
        sourceName: 'NARA Catalog',
        institution: NARA,
        collection: path || (r.recordGroupNumber !== undefined ? `Record Group ${r.recordGroupNumber}` : ''),
        reference: [`NAID ${naid}`, r.localIdentifier].filter(Boolean).join(', '),
        url: catalogUrl(naid),
        retrievedAt: now.toISOString(),
        query: describeQuery(q),
      },
    };
  });
  return { hits, total: total ?? hits.length };
}

export const naraCatalogAdapter: SourceAdapter = {
  meta: {
    id: 'nara',
    name: 'NARA – National Archives Catalog (USA)',
    description:
      'Gesamter Katalog des US-Nationalarchivs, u. a. erbeutete deutsche Akten (RG 242), Prozessakten, Militärunterlagen.',
    access: 'api-proxy',
    keyName: NARA_KEY,
    keyHelpUrl: 'https://www.archives.gov/research/catalog/help/api',
    homepage: 'https://catalog.archives.gov/',
    termsUrl: 'https://www.archives.gov/research/catalog/help/api',
    attribution: NARA_ATTRIBUTION,
    deepLinkNote: 'Direkte Abfrage mit eigenem NARA-Key und eigenem Proxy (Einstellungen).',
  },
  buildDeepLink: (q) => `https://catalog.archives.gov/search?q=${encodeURIComponent(fullName(q))}`,
  async search(q: PersonQuery, ctx: SearchContext) {
    const proxy = ctx.proxyUrl;
    if (!proxy) throw new MissingProxyError();
    const key = ctx.getKey(NARA_KEY);
    if (!key) throw new MissingKeyError(NARA_KEY);
    const data = await fetchJson<unknown>(ctx, viaProxy(proxy, buildNaraUrl(q)), {
      headers: { 'x-api-key': key, Accept: 'application/json' },
    });
    return parseNara(data, q, ctx.now());
  },
};
