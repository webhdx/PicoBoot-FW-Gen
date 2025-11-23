/**
 * IndexedDB Cache Layer
 *
 * Provides persistent caching with TTL (Time To Live) support.
 * Default TTL: 1 hour
 *
 * Stores:
 * - GitHub releases metadata
 * - Base firmware binaries
 * - Payload binaries
 */

const DB_NAME = 'picoboot-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

export const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

export interface CacheEntry<T = unknown> {
  key: string;
  type: 'firmware' | 'payload' | 'github-releases';
  data: T;
  cachedAt: number; // timestamp
  expiresAt: number; // timestamp
}

export class CacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheError';
  }
}

export class CacheQuotaExceededError extends CacheError {
  constructor() {
    super('Cache quota exceeded');
    this.name = 'CacheQuotaExceededError';
  }
}

/**
 * Opens IndexedDB connection
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new CacheError(`Failed to open database: ${request.error}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
    };
  });
}

/**
 * Gets a value from cache
 */
export async function get<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(key);

      request.onerror = () => {
        reject(new CacheError(`Failed to get cache entry: ${request.error}`));
      };

      request.onsuccess = () => {
        const entry: CacheEntry<T> | undefined = request.result;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
          // Delete expired entry
          remove(key).catch(console.error);
          resolve(null);
          return;
        }

        resolve(entry.data);
      };
    });
  } catch (error) {
    if (error instanceof CacheError) {
      throw error;
    }
    throw new CacheError(
      `Failed to get cache entry: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Sets a value in cache with TTL
 */
export async function set<T>(
  key: string,
  data: T,
  type: CacheEntry['type'],
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      type,
      data,
      cachedAt: now,
      expiresAt: now + ttl,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(entry);

      request.onerror = () => {
        // Check for quota exceeded
        if (request.error?.name === 'QuotaExceededError') {
          reject(new CacheQuotaExceededError());
        } else {
          reject(
            new CacheError(`Failed to set cache entry: ${request.error}`)
          );
        }
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    if (
      error instanceof CacheError ||
      error instanceof CacheQuotaExceededError
    ) {
      throw error;
    }
    throw new CacheError(
      `Failed to set cache entry: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Removes a value from cache
 */
export async function remove(key: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(key);

      request.onerror = () => {
        reject(
          new CacheError(`Failed to remove cache entry: ${request.error}`)
        );
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    if (error instanceof CacheError) {
      throw error;
    }
    throw new CacheError(
      `Failed to remove cache entry: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Clears all entries of a specific type
 */
export async function clearType(
  type: CacheEntry['type']
): Promise<number> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('type');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(type));
      let count = 0;

      request.onerror = () => {
        reject(new CacheError(`Failed to clear cache type: ${request.error}`));
      };

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          cursor.delete();
          count++;
          cursor.continue();
        } else {
          resolve(count);
        }
      };
    });
  } catch (error) {
    if (error instanceof CacheError) {
      throw error;
    }
    throw new CacheError(
      `Failed to clear cache type: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Clears all expired entries
 */
export async function clearExpired(): Promise<number> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('expiresAt');

    const now = Date.now();

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.upperBound(now));
      let count = 0;

      request.onerror = () => {
        reject(
          new CacheError(`Failed to clear expired entries: ${request.error}`)
        );
      };

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          cursor.delete();
          count++;
          cursor.continue();
        } else {
          resolve(count);
        }
      };
    });
  } catch (error) {
    if (error instanceof CacheError) {
      throw error;
    }
    throw new CacheError(
      `Failed to clear expired entries: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Clears entire cache
 */
export async function clearAll(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();

      request.onerror = () => {
        reject(new CacheError(`Failed to clear cache: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    if (error instanceof CacheError) {
      throw error;
    }
    throw new CacheError(
      `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets cache statistics
 */
export async function getStats(): Promise<{
  totalEntries: number;
  expiredEntries: number;
  byType: Record<CacheEntry['type'], number>;
}> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onerror = () => {
        reject(new CacheError(`Failed to get cache stats: ${request.error}`));
      };

      request.onsuccess = () => {
        const entries: CacheEntry[] = request.result;
        const now = Date.now();

        const stats = {
          totalEntries: entries.length,
          expiredEntries: 0,
          byType: {
            firmware: 0,
            payload: 0,
            'github-releases': 0,
          } as Record<CacheEntry['type'], number>,
        };

        for (const entry of entries) {
          if (entry.expiresAt < now) {
            stats.expiredEntries++;
          }
          stats.byType[entry.type]++;
        }

        resolve(stats);
      };
    });
  } catch (error) {
    if (error instanceof CacheError) {
      throw error;
    }
    throw new CacheError(
      `Failed to get cache stats: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
