import { allAdapters } from '../adapters';
import { append, extLink, h } from './dom';
import { accessLabel } from './search';

const REPO = 'https://github.com/Datenflix007/archive-tracer';

export function renderAbout(main: HTMLElement): void {
  append(main, [
    h('h1', { tabindex: '-1' }, 'Quellen & Grenzen'),
    h('h2', {}, 'Was dieses Werkzeug kann und was nicht'),
    h(
      'ul',
      {},
      h('li', {}, 'Es durchsucht öffentliche Schnittstellen mehrerer Archive gleichzeitig und verlinkt die Suchen aller weiteren Quellen.'),
      h('li', {}, 'Es zeigt nur Metadaten, die die Archive selbst bereitstellen, mit Link auf das Original. Scans oder Dokumente werden weder kopiert noch gespeichert.'),
      h('li', {}, 'Es entscheidet nicht, ob ein Treffer die gesuchte Person betrifft. Das prüfen Sie selbst.'),
      h('li', {}, 'Es ersetzt weder einen Archivbesuch noch eine schriftliche Anfrage. Viele Unterlagen sind nicht online erschlossen.'),
      h('li', {}, 'Für Unterlagen zu Personen, die noch leben könnten, gelten Schutzfristen (z. B. nach dem Bundesarchivgesetz). Auch Angaben zu lebenden Nachfahren sind zu schützen.'),
    ),
    h('h2', {}, 'Datenschutz'),
    h(
      'p',
      {},
      'Es gibt keinen eigenen Server, kein Tracking und keine Analyse. Ihre Suchanfragen gehen direkt von Ihrem Browser an die jeweiligen Archive. Die Recherchemappe und Ihre Einstellungen liegen nur in Ihrem Browser.',
    ),
    h('h2', {}, 'Quellen'),
    h(
      'table',
      { class: 'sources-table' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Quelle'), h('th', { scope: 'col' }, 'Zugang'), h('th', { scope: 'col' }, 'Hinweise'))),
      h(
        'tbody',
        {},
        allAdapters.map((a) =>
          h(
            'tr',
            {},
            h('td', {}, extLink(a.meta.homepage, a.meta.name)),
            h('td', {}, h('span', { class: `tag tag-${a.meta.access}` }, accessLabel(a.meta.access))),
            h(
              'td',
              {},
              a.meta.description,
              a.meta.keyName ? ' Eigener API-Key nötig.' : '',
              a.meta.termsUrl ? [' ', extLink(a.meta.termsUrl, 'Nutzungsbedingungen')] : null,
            ),
          ),
        ),
      ),
    ),
    h(
      'p',
      {},
      'Die ausführliche Prüfung jeder Quelle (Schnittstellen, Nutzungsbedingungen, Einschränkungen) steht in ',
      extLink(`${REPO}/blob/main/docs/sources.md`, 'docs/sources.md'),
      '. Quellcode: ',
      extLink(REPO, 'GitHub'),
      '.',
    ),
  ]);
}
