import type { PersonQuery, SourceAdapter } from '../types';
import { fullName, surnames } from '../lib/query';

/**
 * Sources without a usable public API (docs/sources.md §7–16).
 * No scraping, no internal endpoints: only links that open the source's own search.
 * Findings are copied into the folder manually by the user.
 */
const enc = encodeURIComponent;
const name = (q: PersonQuery) => fullName(q);
const surname = (q: PersonQuery) => surnames(q)[0] ?? '';

const NOT_PREFILLED = 'Die Suche dort lässt sich nicht per Link vorausfüllen. Bitte die Suchbegriffe einfügen.';
const UNVERIFIED = 'Ob die Suche vorausgefüllt erscheint, hängt von der Website ab. Sonst bitte die Suchbegriffe einfügen.';

export const deepLinkAdapters: SourceAdapter[] = [
  {
    meta: {
      id: 'arolsen',
      name: 'Arolsen Archives',
      description: 'Internationales Zentrum über NS-Verfolgung: Dokumente zu Inhaftierung, Zwangsarbeit, Displaced Persons.',
      access: 'deeplink-only',
      homepage: 'https://collections.arolsen-archives.org/',
      termsUrl: 'https://arolsen-archives.org/en/legal-notice/',
      deepLinkNote: UNVERIFIED,
    },
    buildDeepLink: (q) => `https://collections.arolsen-archives.org/en/search?s=${enc(name(q))}`,
  },
  {
    meta: {
      id: 'yadvashem',
      name: 'Yad Vashem – Zentrale Datenbank der Namen der Holocaustopfer',
      description: 'Namen und Lebensdaten ermordeter Jüdinnen und Juden, u. a. aus Gedenkblättern (Pages of Testimony).',
      access: 'deeplink-only',
      homepage: 'https://collections.yadvashem.org/en/names',
      deepLinkNote: UNVERIFIED,
    },
    buildDeepLink: (q) => `https://collections.yadvashem.org/en/names/search-results?q=${enc(name(q))}`,
  },
  {
    meta: {
      id: 'gedenkbuch',
      name: 'Bundesarchiv – Gedenkbuch',
      description: 'Gedenkbuch für die Opfer der Verfolgung der Jüdinnen und Juden in Deutschland 1933–1945.',
      access: 'deeplink-only',
      homepage: 'https://apps.bundesarchiv.de/gedenkbuch/',
      deepLinkNote: NOT_PREFILLED,
    },
    buildDeepLink: () => 'https://apps.bundesarchiv.de/gedenkbuch/directory',
  },
  {
    meta: {
      id: 'ushmm',
      name: 'USHMM – Holocaust Survivors and Victims Database',
      description: 'Namensdatenbank des United States Holocaust Memorial Museum (Listen, Register, Karteien).',
      access: 'deeplink-only',
      homepage: 'https://www.ushmm.org/',
      termsUrl: 'https://www.ushmm.org/information/about-the-museum/terms-of-use',
      deepLinkNote: NOT_PREFILLED,
    },
    buildDeepLink: () =>
      'https://www.ushmm.org/remember/resources-holocaust-survivors-victims/database-of-holocaust-survivor-and-victim-names',
  },
  {
    meta: {
      id: 'joodsmonument',
      name: 'Joods Monument',
      description: 'Digitales Denkmal für die aus den Niederlanden verfolgten und ermordeten Jüdinnen und Juden.',
      access: 'deeplink-only',
      homepage: 'https://www.joodsmonument.nl/',
      termsUrl: 'https://www.joodsmonument.nl/en/page/733/disclaimer',
    },
    buildDeepLink: (q) => `https://www.joodsmonument.nl/en/search?q=${enc(name(q))}`,
  },
  {
    meta: {
      id: 'mappingthelives',
      name: 'Mapping the Lives',
      description: 'Adressen von Menschen, die 1939 in Deutschland lebten und verfolgt wurden (Minderheitenzählung).',
      access: 'deeplink-only',
      homepage: 'https://www.mappingthelives.org/',
      deepLinkNote: NOT_PREFILLED,
    },
    buildDeepLink: () => 'https://www.mappingthelives.org/',
  },
  {
    meta: {
      id: 'invenio',
      name: 'Bundesarchiv – invenio',
      description: 'Recherchesystem des Bundesarchivs. Teile der Erschließung sind auch über Archivportal-D durchsuchbar.',
      access: 'deeplink-only',
      homepage: 'https://invenio.bundesarchiv.de/',
      deepLinkNote: NOT_PREFILLED,
    },
    buildDeepLink: () => 'https://invenio.bundesarchiv.de/invenio/',
  },
  {
    meta: {
      id: 'stolpersteine-berlin',
      name: 'Stolpersteine in Berlin',
      description: 'Datenbank der Koordinierungsstelle Stolpersteine Berlin mit Biografien.',
      access: 'deeplink-only',
      homepage: 'https://www.stolpersteine-berlin.de/',
    },
    buildDeepLink: (q) =>
      `https://www.stolpersteine-berlin.de/de/stolpersteine-finden?name=${enc(surname(q))}&street=&district=All`,
  },
  {
    meta: {
      id: 'stolpersteine-hamburg',
      name: 'Stolpersteine in Hamburg',
      description: 'Biografien zu den Stolpersteinen in Hamburg.',
      access: 'deeplink-only',
      homepage: 'https://stolpersteine-hamburg.de/',
    },
    buildDeepLink: (q) => `https://stolpersteine-hamburg.de/suchergebnisse?search=${enc(surname(q))}`,
  },
  {
    meta: {
      id: 'volksbund',
      name: 'Volksbund – Gräbersuche online',
      description: 'Kriegstote und Vermisste beider Weltkriege und ihre Grablagen.',
      access: 'deeplink-only',
      homepage: 'https://www.volksbund.de/',
      deepLinkNote: NOT_PREFILLED,
    },
    buildDeepLink: () => 'https://www.volksbund.de/erinnern-gedenken/graebersuche-online',
  },
  {
    meta: {
      id: 'wast',
      name: 'Bundesarchiv – ehem. Deutsche Dienststelle (WASt)',
      description: 'Unterlagen zu Angehörigen der Wehrmacht und Kriegsgefangenen. Auskunft nur auf schriftlichen Antrag.',
      access: 'manual-request',
      homepage: 'https://www.bundesarchiv.de/',
      deepLinkNote: 'Keine Online-Suche. Vorlage für die Anfrage unter „Wie geht es weiter?“.',
    },
    buildDeepLink: () =>
      'https://www.bundesarchiv.de/im-archiv-recherchieren/archivgut-recherchieren/personen-und-familienforschung/',
  },
];
