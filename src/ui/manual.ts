import type { PersonQuery, SourceAdapter } from '../types';
import { manualEntry } from '../lib/folder';
import { putEntry } from '../lib/db';
import { describeQuery } from '../lib/query';
import { announce, field, h } from './dom';

/**
 * Dialog for copying a finding from a link-only source into the folder by hand.
 * Nothing is fetched from the source; the user types what they found.
 */
export function openManualDialog(adapter: SourceAdapter, person: PersonQuery): void {
  const input = (attrs: Record<string, string> = {}) => h('input', { type: 'text', ...attrs });
  const title = input({ required: 'true' });
  const institution = input({ value: adapter.meta.name });
  const collection = input();
  const reference = input();
  const url = h('input', { type: 'url', value: adapter.buildDeepLink(person) });
  const dateRange = input();
  const note = h('textarea', { rows: 3 });

  const dialog = h(
    'dialog',
    { class: 'manual', 'aria-labelledby': 'manual-title' },
    h(
      'form',
      { method: 'dialog' },
      h('h2', { id: 'manual-title' }, `Fund aus „${adapter.meta.name}“ übernehmen`),
      h(
        'p',
        { class: 'hint' },
        'Bitte übernehmen Sie die Angaben so, wie sie in der Quelle stehen. Abrufdatum und Ihre Suchanfrage werden automatisch gespeichert.',
      ),
      field('Titel oder Beschreibung des Dokuments *', title, 'z. B. „Häftlingspersonalkarte“ oder „Gedenkblatt“'),
      field('Institution', institution),
      field('Bestand / Sammlung', collection),
      field('Signatur oder Dokument-ID', reference),
      field('Link zum Dokument', url, 'Möglichst den dauerhaften Link (Permalink) des einzelnen Dokuments.'),
      field('Zeitraum', dateRange),
      field('Eigene Notiz', note),
      h(
        'div',
        { class: 'actions' },
        h('button', { type: 'submit', value: 'save', class: 'primary' }, 'In die Mappe'),
        h('button', { type: 'submit', value: 'cancel', formnovalidate: true }, 'Abbrechen'),
      ),
    ),
  );

  dialog.addEventListener('close', async () => {
    if (dialog.returnValue === 'save' && title.value.trim()) {
      const entry = manualEntry(
        {
          title: title.value.trim(),
          dateRange: dateRange.value.trim(),
          note: note.value.trim(),
          provenance: {
            sourceId: adapter.meta.id,
            sourceName: adapter.meta.name,
            institution: institution.value.trim(),
            collection: collection.value.trim(),
            reference: reference.value.trim(),
            url: url.value.trim(),
            query: describeQuery(person),
          },
        },
        person,
      );
      await putEntry(entry);
      announce('Fund in die Recherchemappe übernommen.');
    }
    dialog.remove();
  });

  document.body.appendChild(dialog);
  dialog.showModal();
  title.focus();
}
