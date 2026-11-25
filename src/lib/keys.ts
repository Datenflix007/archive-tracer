/**
 * BYOK key storage. Keys stay in this browser only.
 * Default: sessionStorage (gone when the tab closes).
 * Only on explicit request: localStorage ("auf diesem Gerät merken").
 */
const PREFIX = 'archive-tracer:key:';
const listeners = new Set<() => void>();

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function getKey(name: string): string | null {
  return safe(() => sessionStorage.getItem(PREFIX + name) ?? localStorage.getItem(PREFIX + name), null);
}

export function isPersisted(name: string): boolean {
  return safe(() => localStorage.getItem(PREFIX + name) !== null, false);
}

export function setKey(name: string, value: string, persist: boolean): void {
  removeKey(name);
  const v = value.trim();
  if (!v) return notify();
  safe(() => (persist ? localStorage : sessionStorage).setItem(PREFIX + name, v), undefined);
  notify();
}

export function removeKey(name: string): void {
  safe(() => {
    sessionStorage.removeItem(PREFIX + name);
    localStorage.removeItem(PREFIX + name);
  }, undefined);
  notify();
}

export function hasAnyKey(): boolean {
  return safe(() => {
    for (const store of [sessionStorage, localStorage]) {
      for (let i = 0; i < store.length; i++) if (store.key(i)?.startsWith(PREFIX)) return true;
    }
    return false;
  }, false);
}

export function clearAllKeys(): void {
  safe(() => {
    for (const store of [sessionStorage, localStorage]) {
      const doomed: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k?.startsWith(PREFIX)) doomed.push(k);
      }
      doomed.forEach((k) => store.removeItem(k));
    }
  }, undefined);
  notify();
}

export function onKeysChanged(fn: () => void): void {
  listeners.add(fn);
}

function notify(): void {
  listeners.forEach((fn) => fn());
}
