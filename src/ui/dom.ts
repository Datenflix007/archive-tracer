/**
 * Minimal DOM helper. All text goes through textContent / text nodes, never innerHTML,
 * because archive metadata is untrusted input.
 */
type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'class') {
      el.className = String(v);
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: (Child | Child[])[]): void {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Link to an external page, always opening in a new tab without referrer. */
export function extLink(href: string, text: string, attrs: Attrs = {}): HTMLAnchorElement {
  return h('a', { href, target: '_blank', rel: 'noopener noreferrer', ...attrs }, text, h('span', { class: 'sr-only' }, ' (öffnet in neuem Tab)'));
}

let liveRegion: HTMLElement | null = null;
/** Announce a status message to screen readers and show it briefly. */
export function announce(msg: string): void {
  liveRegion ??= document.getElementById('toast');
  if (!liveRegion) return;
  liveRegion.textContent = msg;
  liveRegion.classList.add('visible');
  window.setTimeout(() => liveRegion?.classList.remove('visible'), 3500);
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    announce('In die Zwischenablage kopiert.');
  } catch {
    announce('Kopieren nicht möglich. Bitte Text markieren und manuell kopieren.');
  }
}

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function field(
  label: string,
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  hint?: string,
): HTMLDivElement {
  const id = input.id || `f-${Math.random().toString(36).slice(2, 9)}`;
  input.id = id;
  const hintEl = hint ? h('small', { id: `${id}-hint`, class: 'hint' }, hint) : null;
  if (hintEl) input.setAttribute('aria-describedby', hintEl.id);
  return h('div', { class: 'field' }, h('label', { for: id }, label), input, hintEl);
}
