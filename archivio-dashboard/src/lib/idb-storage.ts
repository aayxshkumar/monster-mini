import type { StateStorage } from "zustand/middleware";

const DB_NAME = "archivio-booth";
const STORE_NAME = "kv";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await openDb();
      const value: string | null = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(name);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
      if (value === null) {
        const lsValue = localStorage.getItem(name);
        if (lsValue) {
          await idbStorage.setItem(name, lsValue);
          localStorage.removeItem(name);
          return lsValue;
        }
      }
      return value;
    } catch {
      return localStorage.getItem(name);
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, name);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      localStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(name);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      localStorage.removeItem(name);
    }
  },
};
