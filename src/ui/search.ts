import type { Hit, PersonQuery, SearchContext, SourceAdapter } from '../types';
import { MissingKeyError, MissingProxyError, SourceHttpError } from '../types';
import { apiAdapters, linkAdapters } from '../adapters';
import { citation } from '../lib/citation';
import { entryFromHit } from '../lib/folder';
import { putEntry } from '../lib/db';
import { getKey } from '../lib/keys';
import { getProxyUrl } from '../lib/proxy';
import { describeQuery, fullName, hasName } from '../lib/query';
import { announce, append, clear, copyText, extLink, field, h } from './dom';
import { openManualDialog } from './manual';
import { loadOptions, loadQuery, saveOptions, saveQuery, type SearchOptions } from './state';

let currentSearch: AbortController | null = null;
let lastQuery: PersonQuery = loadQuery();

export function renderSearch(main: HTMLElement): void {
  const q = loadQuery();
  const results = h('div', { id: 'results' });

  const inp = (name: keyof PersonQuery, attrs: Record<string, string> = {}) =>
    h('input', { name, type: 'text', value: String(q[name] ?? ''), autocomplete: 'off', ...attrs });

  const firstName = inp('firstName');
  const lastName = inp('lastName', { required: 'true' });
  const birthName = inp('birthName');
  const variants = h('input', { name: 'variants', type: 'text', value: q.variants.join(', '), autocomplete: 'off' });
  const birthDate = h('input', { name: 'birthDate', type: 'date', value: q.birthDate });
  const birthYear = h('input', {
    name: 'birthYear',
    type: 'number',
    min: '1800',
    max: '1950',
    inputmode: 'numeric',
    value: q.birthYear ? String(q.birthYear) : '',
  });
  const tolerance = h('input', { name: 'tol', type: 'number', min: '0', max: '20', value: String(q.birthYearTolerance) });
  const birthPlace = inp('birthPlace');
  const lastResidence = inp('lastResidence');
  const parents = inp('parents');
  const membershipNumber = inp('membershipNumber', { inputmode: 'numeric' });
  const nsdapBox = h('input', { type: 'checkbox', id: 'opt-nsdap' });
  nsdapBox.checked = loadOptions().nsdap;

  const readForm = (): PersonQuery => ({
    firstName: firstName.value.trim(),
    lastName: lastName.value.trim(),
    birthName: birthName.value.trim(),
    variants: variants.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    birthDate: birthDate.value,
    birthYear: birthYear.value ? Number(birthYear.value) : birthDate.value ? Number(birthDate.value.slice(0, 4)) : null,
    birthYearTolerance: Number(tolerance.value || 0),
    birthPlace: birthPlace.value.trim(),
    lastResidence: lastResidence.value.trim(),
    parents: parents.value.trim(),
    membershipNumber: membershipNumber.value.trim(),
  });

  const form = h(
    'form',
    {
      class: 'search-form',
      onsubmit: (e: Event) => {
        e.preventDefault();
        const query = readForm();
        if (!hasName(query)) {
          announce('Bitte mindestens einen Nachnamen eingeben.');
          lastName.focus();
          return;
        }
        saveQuery(query);
        const options: SearchOptions = { nsdap: nsdapBox.checked };
        saveOptions(options);
        void runSearch(query, results, options);
      },
    },
    h(
      'fieldset',
      {},
      h('legend', {}, 'Name'),
      h(
        'div',
        { class: 'grid' },
        field('Vorname(n)', firstName),
        field('Nachname *', lastName),
        field('Geburtsname', birthName, 'z. B. Mädchenname'),
        field('Weitere Schreibweisen', variants, 'durch Komma getrennt, z. B. Goldberg, Goldenberg'),
      ),
    ),
    h(
      'details',
      { class: 'more', open: !!(q.birthDate || q.birthYear || q.birthPlace || q.lastResidence || q.parents || q.membershipNumber) },
      h('summary', {}, 'Weitere Angaben (helfen beim Einordnen der Treffer)'),
      h(
        'div',
        { class: 'grid' },
        field('Geburtsdatum', birthDate),
        field('oder Geburtsjahr', birthYear),
        field('Toleranz (± Jahre)', tolerance),
        field('Geburtsort', birthPlace),
        field('Letzter bekannter Wohnort', lastResidence),
        field('Eltern', parents, 'Namen der Eltern, falls bekannt'),
        field('NSDAP-Mitgliedsnummer', membershipNumber, 'falls bekannt; wird in der Mitgliederkartei (A3340) gesucht'),
      ),
      h(
        'p',
        { class: 'hint' },
        'Die Archive werden derzeit nach Namen durchsucht. Die weiteren Angaben werden mit der Suche gespeichert und erscheinen in der Kopierhilfe. Ein Abgleich der Treffer mit diesen Angaben folgt in einer späteren Version.',
      ),
    ),
    h(
      'div',
      { class: 'check' },
      nsdapBox,
      h(
        'label',
        { for: 'opt-nsdap' },
        'Auch die NSDAP-Mitgliederkartei durchsuchen (NARA A3340; mit eigenem Proxy werden pro Suche etwa 10–15 MB geladen)',
      ),
    ),
    h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary' }, 'Suchen')),
  );

  append(main, [
    h('h1', { tabindex: '-1' }, 'Spuren in Archiven suchen'),
    h(
      'p',
      { class: 'lead' },
      'Durchsucht mehrere Archive und Datenbanken gleichzeitig nach Dokumenten zu einer Person. Quellen ohne öffentliche Schnittstelle erreichen Sie über Links. Alles bleibt in Ihrem Browser.',
    ),
    form,
    results,
  ]);

  if (hasName(q) && sessionStorage.getItem('archive-tracer:searched') === '1') void runSearch(q, results, loadOptions());
}

async function runSearch(q: PersonQuery, results: HTMLElement, options: SearchOptions): Promise<void> {
  currentSearch?.abort();
  const controller = new AbortController();
  currentSearch = controller;
  sessionStorage.setItem('archive-tracer:searched', '1');
  lastQuery = q;
  clear(results);

  const ctx: SearchContext = {
    fetch: (...args) => fetch(...args),
    signal: controller.signal,
    getKey,
    proxyUrl: getProxyUrl(),
    now: () => new Date(),
  };

  append(results, [
    h('h2', {}, 'Ergebnisse für ', h('q', {}, describeQuery(q))),
    h(
      'p',
      { class: 'notice' },
      'Ein Treffer bedeutet nicht, dass es sich um dieselbe Person handelt. Namen, Daten und Orte müssen Sie selbst prüfen. Was Sie in die Mappe übernehmen, wird mit Herkunft und Abrufdatum gespeichert.',
    ),
  ]);

  const apiSection = h('section', { class: 'sources', 'aria-label': 'Direkt durchsuchte Quellen' });
  const linkSection = renderLinkSection(q);
  append(results, [apiSection, linkSection]);

  const active = apiAdapters.filter((a) => options.nsdap || a.meta.id !== 'nara-a3340');
  await Promise.all(
    active.map(async (adapter) => {
      const box = sourceBox(adapter);
      apiSection.appendChild(box.el);
      try {
        const res = await adapter.search!(q, ctx);
        if (controller.signal.aborted) return;
        box.done(res.hits, res.total, q, res.notice);
      } catch (err) {
        if (controller.signal.aborted) return;
        box.fail(err);
      }
    }),
  );
  if (!controller.signal.aborted) announce('Suche abgeschlossen.');
}

function sourceBox(adapter: SourceAdapter) {
  const status = h('p', { class: 'status', role: 'status' }, 'Suche läuft …');
  const list = h('ol', { class: 'hits' });
  const body = h('div', { class: 'source-body' }, status, list);
  const summary = h('summary', {}, h('span', { class: 'source-name' }, adapter.meta.name), h('span', { class: 'badge' }, '…'));
  const el = h('details', { class: 'source', open: true }, summary, body);
  const badge = summary.querySelector('.badge')!;

  return {
    el,
    done(hits: Hit[], total: number, q: PersonQuery, notice?: string) {
      badge.textContent = String(total);
      if (notice) body.insertBefore(h('p', { class: 'source-notice' }, notice), list);
      status.textContent =
        total === 0
          ? 'Keine Treffer.'
          : total > hits.length
            ? `${total} Treffer, die ersten ${hits.length} werden angezeigt.`
            : `${total} Treffer.`;
      if (total > hits.length || total === 0) {
        status.append(' ', extLink(adapter.buildDeepLink(q), 'Im Portal weitersuchen'));
      }
      if (total === 0) el.open = false;
      hits.forEach((hit) => list.appendChild(hitItem(hit, q)));
      if (adapter.meta.attribution) body.appendChild(h('p', { class: 'attribution' }, adapter.meta.attribution));
    },
    fail(err: unknown) {
      badge.textContent = '!';
      if (err instanceof MissingProxyError) {
        status.textContent =
          'Diese Quelle erlaubt keinen direkten Abruf aus dem Browser. Mit einem eigenen, kostenlosen Proxy (und für den NARA-Katalog einem eigenen NARA-Key) wird sie mitdurchsucht. ';
        status.append(h('a', { href: '#/einstellungen' }, 'Einrichten unter „Einstellungen“'), ' · ', extLink(adapter.buildDeepLink(lastQuery), 'Bis dahin: Suche im Katalog öffnen'));
        el.open = false;
      } else if (err instanceof MissingKeyError) {
        status.textContent = 'Für diese Quelle wird ein eigener, kostenloser API-Key benötigt. ';
        status.append(h('a', { href: '#/einstellungen' }, 'Key unter „Einstellungen“ eintragen'));
        el.open = true;
      } else if (err instanceof SourceHttpError && err.status === 429) {
        status.textContent = 'Die Quelle ist gerade ausgelastet. Bitte in einer Minute erneut suchen.';
      } else if (err instanceof SourceHttpError) {
        status.textContent = `Die Quelle hat mit einem Fehler geantwortet (${err.message}). Bitte später erneut versuchen.`;
      } else if (err instanceof DOMException && err.name === 'TimeoutError') {
        status.textContent = 'Die Quelle hat nicht rechtzeitig geantwortet.';
      } else {
        status.textContent = 'Die Quelle ist gerade nicht erreichbar (Netzwerk oder Browser-Sperre).';
      }
    },
  };
}

function hitItem(hit: Hit, q: PersonQuery): HTMLLIElement {
  const p = hit.provenance;
  const cite = citation(hit.title, p);
  const saveBtn = h('button', { type: 'button' }, 'In die Mappe');
  saveBtn.addEventListener('click', async () => {
    await putEntry(entryFromHit(hit, q));
    saveBtn.textContent = 'In der Mappe ✓';
    saveBtn.disabled = true;
    announce('In die Recherchemappe übernommen.');
  });

  const meta = h(
    'dl',
    { class: 'meta' },
    p.institution ? [h('dt', {}, 'Institution'), h('dd', {}, p.institution)] : null,
    p.collection ? [h('dt', {}, 'Bestand'), h('dd', {}, p.collection)] : null,
    p.reference ? [h('dt', {}, 'Signatur/ID'), h('dd', {}, p.reference)] : null,
    hit.dateRange ? [h('dt', {}, 'Zeitraum'), h('dd', {}, hit.dateRange)] : null,
  );

  return h(
    'li',
    { class: 'hit' },
    h('h3', {}, hit.title),
    hit.details.length ? h('p', { class: 'details' }, hit.details.join(' · ')) : null,
    meta,
    h(
      'div',
      { class: 'actions' },
      extLink(p.url, 'Ansehen', { class: 'button' }),
      saveBtn,
      h('button', { type: 'button', onclick: () => void copyText(cite) }, 'Zitat kopieren'),
    ),
    hit.storage === 'link-only'
      ? h('p', { class: 'hint' }, 'Wird in der Mappe nur mit Kennung und Link gespeichert (Nutzungsbedingungen der Quelle).')
      : null,
    h('details', { class: 'cite' }, h('summary', {}, 'Zitiervorschlag'), h('p', {}, cite)),
  );
}

function renderLinkSection(q: PersonQuery): HTMLElement {
  const terms = [
    fullName(q),
    q.birthName && `geb. ${q.birthName}`,
    q.birthDate || (q.birthYear ? String(q.birthYear) : ''),
    q.birthPlace,
  ]
    .filter(Boolean)
    .join(', ');

  const openAll = h('button', { type: 'button' }, 'Alle Links öffnen');
  openAll.addEventListener('click', () => {
    let blocked = 0;
    for (const a of linkAdapters) {
      const w = window.open(a.buildDeepLink(q), '_blank');
      if (w) w.opener = null;
      else blocked++;
    }
    if (blocked) {
      announce(`${blocked} Tab(s) wurden vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.`);
    }
  });

  return h(
    'section',
    { class: 'links', 'aria-labelledby': 'links-h' },
    h('h2', { id: 'links-h' }, 'Weitere Quellen (nur über Links)'),
    h(
      'p',
      {},
      'Diese Archive bieten keine öffentliche Schnittstelle, oder ihre Nutzungsbedingungen erlauben keine automatische Abfrage. Öffnen Sie dort die Suche und übernehmen Sie Funde mit „Fund übernehmen“ in die Mappe.',
    ),
    h(
      'div',
      { class: 'copybar' },
      h('span', {}, 'Suchbegriffe: ', h('strong', {}, terms)),
      h('button', { type: 'button', onclick: () => void copyText(terms) }, 'Kopieren'),
      openAll,
    ),
    h(
      'ul',
      { class: 'link-list' },
      linkAdapters.map((a) =>
        h(
          'li',
          {},
          h('div', {}, h('strong', {}, a.meta.name), h('span', { class: `tag tag-${a.meta.access}` }, accessLabel(a.meta.access))),
          h('p', { class: 'details' }, a.meta.description),
          a.meta.deepLinkNote ? h('p', { class: 'hint' }, a.meta.deepLinkNote) : null,
          h(
            'div',
            { class: 'actions' },
            extLink(a.buildDeepLink(q), a.meta.access === 'manual-request' ? 'Informationen' : 'Suche öffnen', { class: 'button' }),
            h('button', { type: 'button', onclick: () => openManualDialog(a, q) }, 'Fund übernehmen'),
          ),
        ),
      ),
    ),
  );
}

export function accessLabel(access: string): string {
  switch (access) {
    case 'api-browser':
      return 'direkt durchsucht';
    case 'api-proxy':
      return 'Schnittstelle (folgt)';
    case 'deeplink-only':
      return 'nur Link';
    default:
      return 'schriftliche Anfrage';
  }
}
