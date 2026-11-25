import type { FolderEntry } from '../lib/folder';
import { parseFolderImport } from '../lib/folder';
import { clearEntries, deleteEntry, listEntries, putEntries, putEntry } from '../lib/db';
import { formatDate } from '../lib/citation';
import { toCsv, toGedcom, toJson } from '../lib/export';
import { announce, append, clear, copyText, download, extLink, h } from './dom';

export async function renderFolder(main: HTMLElement): Promise<void> {
  const list = h('div', { class: 'folder' });
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file' });

  const stamp = () => new Date().toISOString().slice(0, 10);
  const toolbar = h(
    'div',
    { class: 'toolbar' },
    h('button', { type: 'button', onclick: async () => download(`recherchemappe-${stamp()}.json`, toJson(await listEntries()), 'application/json') }, 'Export JSON'),
    h('button', { type: 'button', onclick: async () => download(`recherchemappe-${stamp()}.csv`, toCsv(await listEntries()), 'text/csv;charset=utf-8') }, 'Export CSV'),
    h('button', { type: 'button', onclick: async () => download(`recherchemappe-${stamp()}.ged`, toGedcom(await listEntries()), 'text/plain;charset=utf-8') }, 'Export GEDCOM'),
    h('label', { for: 'import-file', class: 'button' }, 'Import JSON'),
    fileInput,
    h(
      'button',
      {
        type: 'button',
        class: 'danger',
        onclick: async () => {
          if (!window.confirm('Die gesamte Recherchemappe in diesem Browser löschen? Das lässt sich nicht rückgängig machen. Exportieren Sie die Mappe vorher, wenn Sie sie behalten möchten.')) return;
          await clearEntries();
          announce('Recherchemappe geleert.');
          await refresh();
        },
      },
      'Mappe leeren',
    ),
  );

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const entries = parseFolderImport(JSON.parse(await file.text()));
      await putEntries(entries);
      announce(`${entries.length} Einträge importiert.`);
      await refresh();
    } catch (e) {
      announce(e instanceof Error ? e.message : 'Import fehlgeschlagen.');
    }
    fileInput.value = '';
  });

  append(main, [
    h('h1', { tabindex: '-1' }, 'Recherchemappe'),
    h(
      'p',
      { class: 'lead' },
      'Ihre gesammelten Funde, gespeichert nur in diesem Browser (IndexedDB). Jeder Eintrag enthält Herkunft, Abrufdatum und die Suchanfrage. Sichern Sie die Mappe regelmäßig per Export.',
    ),
    toolbar,
    list,
  ]);

  async function refresh(): Promise<void> {
    clear(list);
    const entries = await listEntries();
    if (!entries.length) {
      list.appendChild(h('p', { class: 'empty' }, 'Die Mappe ist noch leer. Übernehmen Sie Treffer aus der ', h('a', { href: '#/' }, 'Suche'), '.'));
      return;
    }
    const groups = new Map<string, FolderEntry[]>();
    entries.forEach((e) => groups.set(e.personLabel, [...(groups.get(e.personLabel) ?? []), e]));
    for (const [person, items] of groups) {
      list.appendChild(
        h(
          'section',
          { class: 'person' },
          h('h2', {}, person, h('span', { class: 'badge' }, String(items.length))),
          h('ol', { class: 'hits' }, items.map((e) => entryItem(e, refresh))),
        ),
      );
    }
  }

  await refresh();
}

function entryItem(e: FolderEntry, refresh: () => Promise<void>): HTMLLIElement {
  const p = e.provenance;
  const note = h('textarea', { rows: 2, 'aria-label': `Notiz zu ${e.title}` });
  note.value = e.note;
  note.addEventListener('change', async () => {
    await putEntry({ ...e, note: note.value, updatedAt: new Date().toISOString() });
    e.note = note.value;
    announce('Notiz gespeichert.');
  });

  return h(
    'li',
    { class: 'hit' },
    h('h3', {}, e.title),
    h(
      'dl',
      { class: 'meta' },
      h('dt', {}, 'Quelle'),
      h('dd', {}, p.sourceName, ' ', h('span', { class: 'tag' }, e.kind === 'api' ? 'aus Schnittstelle' : 'manuell übernommen')),
      p.institution ? [h('dt', {}, 'Institution'), h('dd', {}, p.institution)] : null,
      p.collection ? [h('dt', {}, 'Bestand'), h('dd', {}, p.collection)] : null,
      p.reference ? [h('dt', {}, 'Signatur/ID'), h('dd', {}, p.reference)] : null,
      e.dateRange ? [h('dt', {}, 'Zeitraum'), h('dd', {}, e.dateRange)] : null,
      h('dt', {}, 'Abgerufen'),
      h('dd', {}, formatDate(p.retrievedAt)),
      h('dt', {}, 'Suchanfrage'),
      h('dd', {}, p.query),
    ),
    h('details', { class: 'cite' }, h('summary', {}, 'Zitiervorschlag'), h('p', {}, e.citation)),
    h('div', { class: 'field' }, h('label', {}, 'Eigene Notiz'), note),
    h(
      'div',
      { class: 'actions' },
      p.url ? extLink(p.url, 'Ansehen', { class: 'button' }) : null,
      h('button', { type: 'button', onclick: () => void copyText(e.citation) }, 'Zitat kopieren'),
      h(
        'button',
        {
          type: 'button',
          class: 'danger',
          onclick: async () => {
            if (!window.confirm(`„${e.title}“ aus der Mappe entfernen?`)) return;
            await deleteEntry(e.id);
            await refresh();
          },
        },
        'Entfernen',
      ),
    ),
  );
}
