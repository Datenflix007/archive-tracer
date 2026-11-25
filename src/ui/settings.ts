import { apiAdapters } from '../adapters';
import { clearAllKeys, getKey, isPersisted, removeKey, setKey } from '../lib/keys';
import { announce, append, extLink, field, h } from './dom';
import { applyTheme, getTheme, type Theme } from './theme';

export function renderSettings(main: HTMLElement): void {
  const keyed = apiAdapters.filter((a) => a.meta.keyName);

  append(main, [
    h('h1', { tabindex: '-1' }, 'Einstellungen'),
    h('h2', {}, 'API-Keys (eigene Schlüssel)'),
    h(
      'p',
      {},
      'Einige Quellen verlangen einen persönlichen, kostenlosen API-Key. Er bleibt in Ihrem Browser und wird nur an die jeweilige Quelle geschickt. Standardmäßig gilt er nur für diesen Tab und verschwindet beim Schließen. Nur wenn Sie „auf diesem Gerät merken“ wählen, bleibt er gespeichert.',
    ),
    ...keyed.map((a) => {
      const name = a.meta.keyName!;
      const input = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', value: getKey(name) ?? '' });
      const persist = h('input', { type: 'checkbox', id: `persist-${name}` });
      persist.checked = isPersisted(name);
      return h(
        'form',
        {
          class: 'key-form',
          onsubmit: (e: Event) => {
            e.preventDefault();
            setKey(name, input.value, persist.checked);
            announce(input.value.trim() ? `Key für ${a.meta.name} gespeichert.` : `Key für ${a.meta.name} entfernt.`);
          },
        },
        h('h3', {}, a.meta.name),
        field('API-Key', input),
        h('div', { class: 'check' }, persist, h('label', { for: `persist-${name}` }, 'Auf diesem Gerät merken (nicht auf gemeinsam genutzten Geräten)')),
        a.meta.keyHelpUrl ? h('p', { class: 'hint' }, extLink(a.meta.keyHelpUrl, 'So bekommen Sie einen Key')) : null,
        h(
          'div',
          { class: 'actions' },
          h('button', { type: 'submit', class: 'primary' }, 'Speichern'),
          h(
            'button',
            {
              type: 'button',
              onclick: () => {
                removeKey(name);
                input.value = '';
                persist.checked = false;
                announce('Key entfernt.');
              },
            },
            'Entfernen',
          ),
        ),
      );
    }),
    h(
      'div',
      { class: 'actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'danger',
          onclick: () => {
            clearAllKeys();
            main.querySelectorAll<HTMLInputElement>('.key-form input').forEach((i) => {
              if (i.type === 'checkbox') i.checked = false;
              else i.value = '';
            });
            announce('Alle Keys gelöscht.');
          },
        },
        'Alle Keys löschen',
      ),
    ),
    h('h2', {}, 'Darstellung'),
    themeSelect(),
  ]);
}

function themeSelect(): HTMLElement {
  const select = h(
    'select',
    {},
    h('option', { value: 'system' }, 'Wie im System'),
    h('option', { value: 'light' }, 'Hell'),
    h('option', { value: 'dark' }, 'Dunkel'),
  );
  select.value = getTheme();
  select.addEventListener('change', () => applyTheme(select.value as Theme, true));
  return field('Farbschema', select);
}
