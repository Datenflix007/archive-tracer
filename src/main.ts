import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { clearAllKeys, hasAnyKey, onKeysChanged } from './lib/keys';
import { announce, clear } from './ui/dom';
import { renderAbout } from './ui/about';
import { renderFolder } from './ui/folder';
import { renderNext } from './ui/next';
import { renderSearch } from './ui/search';
import { renderSettings } from './ui/settings';
import { applyTheme } from './ui/theme';

const ROUTES: Record<string, { title: string; render: (main: HTMLElement) => void | Promise<void> }> = {
  '/': { title: 'Suche', render: renderSearch },
  '/mappe': { title: 'Recherchemappe', render: renderFolder },
  '/weiter': { title: 'Wie geht es weiter?', render: renderNext },
  '/einstellungen': { title: 'Einstellungen', render: renderSettings },
  '/quellen': { title: 'Quellen & Grenzen', render: renderAbout },
};

function currentPath(): string {
  const p = location.hash.replace(/^#/, '') || '/';
  return p in ROUTES ? p : '/';
}

async function route(): Promise<void> {
  const main = document.getElementById('main')!;
  const path = currentPath();
  const r = ROUTES[path]!;
  clear(main);
  document.title = `${r.title} – archive-tracer`;
  document.querySelectorAll<HTMLAnchorElement>('nav a').forEach((a) => {
    if (a.getAttribute('href') === `#${path}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  await r.render(main);
  main.querySelector<HTMLElement>('h1')?.focus();
}

function updateKeyButton(): void {
  const btn = document.getElementById('clear-keys')!;
  btn.hidden = !hasAnyKey();
}

applyTheme();
window.addEventListener('hashchange', () => void route());
document.getElementById('clear-keys')!.addEventListener('click', () => {
  clearAllKeys();
  announce('Alle API-Keys wurden gelöscht.');
  if (currentPath() === '/einstellungen') void route();
});
onKeysChanged(updateKeyButton);
updateKeyButton();
void route();

registerSW({ immediate: true });
