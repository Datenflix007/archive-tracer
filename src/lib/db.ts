import type { FolderEntry } from './folder';

const DB_NAME = 'archive-tracer';
const STORE = 'entries';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req ? req.result : undefined);
    };
    t.onerror = () => reject(t.error);
  });
}

export async function listEntries(): Promise<FolderEntry[]> {
  const all = (await tx<FolderEntry[]>('readonly', (s) => s.getAll())) ?? [];
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function putEntry(e: FolderEntry): Promise<void> {
  await tx('readwrite', (s) => s.put(e));
}

export async function putEntries(entries: FolderEntry[]): Promise<void> {
  await tx('readwrite', (s) => {
    entries.forEach((e) => s.put(e));
  });
}

export async function deleteEntry(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function clearEntries(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
}
