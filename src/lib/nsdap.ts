/**
 * NARA A3340 — NSDAP membership card index (RG 242), published by NARA as an open dataset
 * (S3 bucket "nara-nsdap", manifest in github.com/usnationalarchives/nsdap).
 * Ported from NARA Trace (roll selection and frame search), adapted for the browser.
 *
 * - MFKL: Zentralkartei (alphabetical central card index), primary for name searches.
 * - MFOK: Ortsgruppenkartei (local branch card index), independent, separately labelled.
 */

export const MANIFEST_URL = 'https://raw.githubusercontent.com/usnationalarchives/nsdap/main/docs/nsdap.json';
export const S3_HTTP_BASE = 'https://nara-nsdap.s3.us-east-2.amazonaws.com';

export type Collection = 'MFKL' | 'MFOK';

/** Without a first name, frequent surnames span many rolls; load only the first few. */
export const MAX_ROLLS_WITHOUT_FIRST_NAME = 3;

export const COLLECTION_LABEL: Record<Collection, string> = {
  MFKL: 'NSDAP-Zentralkartei (MFKL)',
  MFOK: 'NSDAP-Ortsgruppenkartei (MFOK)',
};

export interface ManifestEntry {
  id: string;
  agency: string;
  box: string;
  title: string;
  s3: string;
}

export interface Roll {
  naid: string;
  collection: Collection;
  box: string;
  title: string;
  s3Path: string;
  rangeStart: string | null;
  rangeEnd: string | null;
}

export interface Frame {
  roll: Roll;
  /** 1-based position within the roll (= objectPage in the NARA catalog). */
  frameNumber: number;
  objectId: string | null;
  objectFilename: string | null;
  text: string;
}

export function splitRollRange(title: string): [string | null, string | null] {
  if (!title.includes(' - ')) return [null, null];
  const i = title.indexOf(' - ');
  return [title.slice(0, i).trim(), title.slice(i + 3).trim()];
}

export function parseManifest(data: unknown): Roll[] {
  if (!Array.isArray(data)) throw new Error('NSDAP manifest is not a list');
  const rolls: Roll[] = [];
  for (const e of data as Partial<ManifestEntry>[]) {
    const collection = String(e?.agency ?? '').toUpperCase();
    if ((collection !== 'MFKL' && collection !== 'MFOK') || !e.id || !e.box || !e.title || !e.s3) continue;
    const [rangeStart, rangeEnd] = splitRollRange(e.title);
    rolls.push({ naid: String(e.id), collection, box: e.box, title: e.title, s3Path: e.s3, rangeStart, rangeEnd });
  }
  return rolls;
}

/** Accent-insensitive key for roll ranges (same folding as NARA Trace, incl. tz → z). */
export function normalizeRollKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/tz/g, 'z')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Normalisation for comparing names in OCR text: additionally folds ae/oe/ue (Mueller = Müller). */
export function normalizeText(value: string): string {
  return normalizeRollKey(value).replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
}

function levenshteinRatio(a: string, b: string): number {
  if (!a.length && !b.length) return 100;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return (1 - prev[b.length]! / Math.max(a.length, b.length)) * 100;
}

function rollContains(roll: Roll, key: string): boolean {
  const s = normalizeRollKey(roll.rangeStart ?? '');
  const e = normalizeRollKey(roll.rangeEnd ?? '');
  return !!s && !!e && s <= key && key <= e;
}

function proximity(roll: Roll, key: string): number {
  return Math.max(
    levenshteinRatio(key, normalizeRollKey(roll.rangeStart ?? '')),
    levenshteinRatio(key, normalizeRollKey(roll.rangeEnd ?? '')),
  );
}

function nearestIndex(rolls: Roll[], key: string): number | null {
  const bounded = rolls.map((r, i) => [i, normalizeRollKey(r.rangeStart ?? '')] as const).filter(([i]) => rolls[i]!.rangeStart && rolls[i]!.rangeEnd);
  if (!bounded.length) return null;
  for (const [i, start] of bounded) if (key < start) return Math.max(0, i - 1);
  return bounded[bounded.length - 1]![0];
}

/**
 * Select the roll whose alphabetical range contains the surname, plus neighbours
 * (range boundaries, spelling/OCR uncertainty), per collection. Never the whole corpus.
 */
export function selectRolls(
  rolls: Roll[],
  surname: string,
  firstName = '',
  collections: Collection[] = ['MFKL', 'MFOK'],
  neighbors = 1,
): Roll[] {
  const surnameKey = normalizeRollKey(surname);
  if (!surnameKey) return [];
  // Cards are filed "Surname, First name": a surname alone sorts before all its rolls,
  // so the first name is part of the key when known.
  const key = normalizeRollKey(`${surname} ${firstName}`);
  const out: Roll[] = [];
  for (const c of collections) {
    const list = rolls.filter((r) => r.collection === c);
    if (!normalizeRollKey(firstName)) {
      // Without a first name: the first rolls of this surname (bounded).
      const starts = (r: Roll) =>
        [r.rangeStart, r.rangeEnd].some((x) => {
          const k = normalizeRollKey(x ?? '');
          return k === surnameKey || k.startsWith(`${surnameKey} `);
        });
      const idx = list.findIndex(starts);
      if (idx >= 0) {
        // idx is the first roll whose range bound carries the surname; the roll before cannot contain it.
        out.push(...list.slice(idx, idx + MAX_ROLLS_WITHOUT_FIRST_NAME));
        continue;
      }
    }
    let primary = list.flatMap((r, i) => (rollContains(r, key) ? [i] : []));
    if (primary.length > 1) {
      // MFKL contains more than one alphabetical run: keep the closest range.
      primary = [primary.reduce((best, i) => (proximity(list[i]!, key) > proximity(list[best]!, key) ? i : best))];
    }
    if (!primary.length) {
      const n = nearestIndex(list, key);
      if (n !== null) primary = [n];
    }
    for (const p of primary) out.push(...list.slice(Math.max(0, p - neighbors), p + neighbors + 1));
  }
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.naid) ? false : (seen.add(r.naid), true)));
}

export function rollJsonUrl(roll: Roll): string {
  const path = roll.s3Path.replace(/^s3:\/\/nara-nsdap\//, '').replace(/^\/+|\/+$/g, '');
  if (!path || path.startsWith('s3://') || !/^[A-Za-z0-9/_-]+$/.test(path)) {
    throw new Error('Roll path is not part of the public NARA bucket');
  }
  return `${S3_HTTP_BASE}/${path}/${encodeURIComponent(roll.naid)}.json`;
}

export function catalogUrl(naid: string, objectPage?: number): string {
  return `https://catalog.archives.gov/id/${encodeURIComponent(naid)}${objectPage ? `?objectPage=${objectPage}` : ''}`;
}

interface RollDocument {
  _source?: { record?: { digitalObjects?: Record<string, unknown>[] } };
}

export function parseRollDocument(data: unknown, roll: Roll): Frame[] {
  const objects = (data as RollDocument)?._source?.record?.digitalObjects;
  if (!Array.isArray(objects)) throw new Error('Roll JSON has no digital objects');
  const str = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null);
  return objects.map((o, i) => ({
    roll,
    frameNumber: i + 1,
    objectId: str(o.objectId),
    objectFilename: str(o.objectFilename),
    text: str(o.extractedText) ?? '',
  }));
}

export interface FrameMatch {
  frame: Frame;
  surname: string;
  firstNameFound: boolean;
  membershipNumberFound: boolean;
  /** Short excerpt of the machine OCR around the name. */
  excerpt: string;
  score: number;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function wordRe(normalized: string): RegExp {
  return new RegExp(`(^| )${escapeRe(normalized)}( |$)`);
}

function excerptFor(text: string, surnameNorm: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const idx = lines.findIndex((l) => normalizeText(l).includes(surnameNorm));
  const pick = idx >= 0 ? lines.slice(idx, idx + 3) : lines.slice(0, 3);
  const s = pick.join(' · ');
  return s.length > 180 ? s.slice(0, 179) + '…' : s;
}

/**
 * Find frames whose OCR text contains one of the surnames as a word.
 * The OCR is NARA's machine transcription: hits are hints, never proof.
 */
export function searchFrames(
  frames: Frame[],
  surnames: string[],
  firstName: string,
  membershipNumber = '',
): FrameMatch[] {
  const sn = surnames.map((s) => [s, normalizeText(s)] as const).filter(([, n]) => n);
  const firstTokens = normalizeText(firstName).split(' ').filter((t) => t.length > 1);
  const number = membershipNumber.replace(/\D+/g, '');
  const matches: FrameMatch[] = [];
  for (const frame of frames) {
    if (!frame.text) continue;
    const norm = normalizeText(frame.text);
    const hit = sn.find(([, n]) => wordRe(n).test(norm));
    const digits = number ? frame.text.replace(/(\d)[.\s](?=\d)/g, '$1') : '';
    const numberFound = !!number && number.length >= 3 && digits.includes(number);
    if (!hit && !numberFound) continue;
    const firstFound = firstTokens.length > 0 && firstTokens.some((t) => wordRe(t).test(norm));
    matches.push({
      frame,
      surname: hit?.[0] ?? '',
      firstNameFound: firstFound,
      membershipNumberFound: numberFound,
      excerpt: excerptFor(frame.text, hit?.[1] ?? number),
      score: (hit ? 1 : 0) + (firstFound ? 2 : 0) + (numberFound ? 4 : 0) + (frame.roll.collection === 'MFKL' ? 0.5 : 0),
    });
  }
  return matches.sort((a, b) => b.score - a.score || a.frame.frameNumber - b.frame.frameNumber);
}
