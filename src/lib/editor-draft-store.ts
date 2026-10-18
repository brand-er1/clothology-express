/**
 * Tiny IndexedDB key-value store for in-progress design editor drafts (artwork + every layer's
 * position/size/rotation/flip), so a reload or a later visit picks up exactly where the customer
 * left off. IndexedDB rather than localStorage because drafts carry base64 artwork that easily
 * exceeds localStorage's ~5MB quota.
 *
 * Every call fails soft (resolves to null / does nothing): private browsing, blocked storage or a
 * missing IndexedDB must never break the editor itself — the draft just isn't remembered.
 */
const DB_NAME = "brander-editor-drafts";
const STORE_NAME = "drafts";
const DB_VERSION = 1;

let databasePromise: Promise<IDBDatabase> | null = null;

const openDatabase = () => {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  databasePromise.catch(() => {
    databasePromise = null;
  });
  return databasePromise;
};

const runRequest = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> => {
  try {
    const database = await openDatabase();
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Editor draft storage unavailable:", error);
    return null;
  }
};

/** Drafts older than this are treated as abandoned and ignored. */
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredDraft<T> {
  savedAt: number;
  version: number;
  data: T;
}

export const loadEditorDraft = async <T>(key: string, version: number): Promise<T | null> => {
  const stored = await runRequest<StoredDraft<T>>("readonly", (store) => store.get(key));
  if (!stored || stored.version !== version || Date.now() - stored.savedAt > DRAFT_MAX_AGE_MS) {
    return null;
  }
  return stored.data;
};

export const saveEditorDraft = async <T>(key: string, version: number, data: T) => {
  const draft: StoredDraft<T> = { savedAt: Date.now(), version, data };
  await runRequest("readwrite", (store) => store.put(draft, key));
};

export const clearEditorDraft = async (key: string) => {
  await runRequest("readwrite", (store) => store.delete(key));
};
