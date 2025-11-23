import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  get,
  set,
  remove,
  clearType,
  clearExpired,
  clearAll,
  getStats,
  DEFAULT_TTL,
  CacheError,
  CacheQuotaExceededError,
} from '../../../../src/lib/storage/cache';
import type { CacheEntry } from '../../../../src/lib/storage/cache';

// Setup fake-indexeddb
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('IndexedDB Cache', () => {
  beforeEach(async () => {
    // Reset IndexedDB before each test
    globalThis.indexedDB = new IDBFactory();
    await clearAll();
  });

  afterEach(async () => {
    await clearAll();
  });

  describe('get and set', () => {
    it('should store and retrieve a value', async () => {
      const testData = { foo: 'bar', num: 42 };

      await set('test-key', testData, 'firmware');
      const retrieved = await get<typeof testData>('test-key');

      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent key', async () => {
      const result = await get('non-existent');
      expect(result).toBeNull();
    });

    it('should store string data', async () => {
      await set('str-key', 'hello world', 'payload');
      const result = await get<string>('str-key');
      expect(result).toBe('hello world');
    });

    it('should store number data', async () => {
      await set('num-key', 12345, 'firmware');
      const result = await get<number>('num-key');
      expect(result).toBe(12345);
    });

    it('should store binary data (Uint8Array)', async () => {
      const binary = new Uint8Array([1, 2, 3, 4, 5]);
      await set('bin-key', binary, 'payload');
      const result = await get<Uint8Array>('bin-key');
      expect(result).toEqual(binary);
    });

    it('should store array data', async () => {
      const array = [1, 2, 3, 'four', { five: 5 }];
      await set('arr-key', array, 'github-releases');
      const result = await get<typeof array>('arr-key');
      expect(result).toEqual(array);
    });

    it('should overwrite existing key', async () => {
      await set('key', 'first', 'firmware');
      await set('key', 'second', 'firmware');
      const result = await get<string>('key');
      expect(result).toBe('second');
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should use default TTL (1 hour)', async () => {
      await set('ttl-key', 'data', 'firmware');
      const result = await get<string>('ttl-key');
      expect(result).toBe('data');
    });

    it('should use custom TTL', async () => {
      const customTTL = 5000; // 5 seconds
      await set('custom-ttl', 'data', 'firmware', customTTL);
      const result = await get<string>('custom-ttl');
      expect(result).toBe('data');
    });

    it('should return null for expired entry', async () => {
      const shortTTL = 1; // 1 millisecond
      await set('expired', 'data', 'firmware', shortTTL);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await get<string>('expired');
      expect(result).toBeNull();
    });

    it('should not return expired entry even if not cleaned up', async () => {
      // Simulate entry that expired but wasn't cleaned up yet
      const shortTTL = 1;
      await set('will-expire', 'data', 'firmware', shortTTL);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await get<string>('will-expire');
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove existing entry', async () => {
      await set('to-remove', 'data', 'firmware');
      expect(await get('to-remove')).toBe('data');

      await remove('to-remove');
      expect(await get('to-remove')).toBeNull();
    });

    it('should not throw when removing non-existent key', async () => {
      await expect(remove('non-existent')).resolves.toBeUndefined();
    });

    it('should remove only specified key', async () => {
      await set('key1', 'data1', 'firmware');
      await set('key2', 'data2', 'firmware');
      await set('key3', 'data3', 'firmware');

      await remove('key2');

      expect(await get('key1')).toBe('data1');
      expect(await get('key2')).toBeNull();
      expect(await get('key3')).toBe('data3');
    });
  });

  describe('clearType', () => {
    it('should clear all entries of specified type', async () => {
      await set('fw1', 'data1', 'firmware');
      await set('fw2', 'data2', 'firmware');
      await set('pl1', 'data1', 'payload');
      await set('gh1', 'data1', 'github-releases');

      const cleared = await clearType('firmware');

      expect(cleared).toBe(2);
      expect(await get('fw1')).toBeNull();
      expect(await get('fw2')).toBeNull();
      expect(await get('pl1')).toBe('data1');
      expect(await get('gh1')).toBe('data1');
    });

    it('should return 0 when no entries of type exist', async () => {
      await set('pl1', 'data', 'payload');
      const cleared = await clearType('firmware');
      expect(cleared).toBe(0);
    });

    it('should clear payload type', async () => {
      await set('pl1', 'data1', 'payload');
      await set('pl2', 'data2', 'payload');
      await set('fw1', 'data', 'firmware');

      const cleared = await clearType('payload');

      expect(cleared).toBe(2);
      expect(await get('fw1')).toBe('data');
    });

    it('should clear github-releases type', async () => {
      await set('gh1', 'data1', 'github-releases');
      await set('gh2', 'data2', 'github-releases');
      await set('fw1', 'data', 'firmware');

      const cleared = await clearType('github-releases');

      expect(cleared).toBe(2);
      expect(await get('fw1')).toBe('data');
    });
  });

  describe('clearExpired', () => {
    it('should clear all expired entries', async () => {
      const shortTTL = 1;
      const longTTL = 60000;

      await set('expired1', 'data1', 'firmware', shortTTL);
      await set('expired2', 'data2', 'payload', shortTTL);
      await set('valid', 'data3', 'firmware', longTTL);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cleared = await clearExpired();

      expect(cleared).toBe(2);
      expect(await get('valid')).toBe('data3');
    });

    it('should return 0 when no expired entries', async () => {
      await set('valid1', 'data1', 'firmware');
      await set('valid2', 'data2', 'payload');

      const cleared = await clearExpired();
      expect(cleared).toBe(0);
    });

    it('should not clear non-expired entries', async () => {
      await set('key1', 'data1', 'firmware', 60000);
      await set('key2', 'data2', 'firmware', 60000);

      const cleared = await clearExpired();

      expect(cleared).toBe(0);
      expect(await get('key1')).toBe('data1');
      expect(await get('key2')).toBe('data2');
    });
  });

  describe('clearAll', () => {
    it('should clear entire cache', async () => {
      await set('key1', 'data1', 'firmware');
      await set('key2', 'data2', 'payload');
      await set('key3', 'data3', 'github-releases');

      await clearAll();

      expect(await get('key1')).toBeNull();
      expect(await get('key2')).toBeNull();
      expect(await get('key3')).toBeNull();
    });

    it('should work on empty cache', async () => {
      await expect(clearAll()).resolves.toBeUndefined();
    });

    it('should allow new entries after clear', async () => {
      await set('old', 'data', 'firmware');
      await clearAll();
      await set('new', 'data', 'firmware');

      expect(await get('old')).toBeNull();
      expect(await get('new')).toBe('data');
    });
  });

  describe('getStats', () => {
    it('should return correct stats for empty cache', async () => {
      const stats = await getStats();

      expect(stats).toEqual({
        totalEntries: 0,
        expiredEntries: 0,
        byType: {
          firmware: 0,
          payload: 0,
          'github-releases': 0,
        },
      });
    });

    it('should count total entries', async () => {
      await set('key1', 'data1', 'firmware');
      await set('key2', 'data2', 'payload');
      await set('key3', 'data3', 'github-releases');

      const stats = await getStats();

      expect(stats.totalEntries).toBe(3);
    });

    it('should count entries by type', async () => {
      await set('fw1', 'data', 'firmware');
      await set('fw2', 'data', 'firmware');
      await set('pl1', 'data', 'payload');
      await set('gh1', 'data', 'github-releases');

      const stats = await getStats();

      expect(stats.byType).toEqual({
        firmware: 2,
        payload: 1,
        'github-releases': 1,
      });
    });

    it('should count expired entries', async () => {
      const shortTTL = 1;
      const longTTL = 60000;

      await set('expired1', 'data', 'firmware', shortTTL);
      await set('expired2', 'data', 'payload', shortTTL);
      await set('valid', 'data', 'firmware', longTTL);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = await getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.expiredEntries).toBe(2);
    });

    it('should update after adding entries', async () => {
      let stats = await getStats();
      expect(stats.totalEntries).toBe(0);

      await set('key1', 'data', 'firmware');
      stats = await getStats();
      expect(stats.totalEntries).toBe(1);

      await set('key2', 'data', 'payload');
      stats = await getStats();
      expect(stats.totalEntries).toBe(2);
    });

    it('should update after removing entries', async () => {
      await set('key1', 'data', 'firmware');
      await set('key2', 'data', 'firmware');

      let stats = await getStats();
      expect(stats.totalEntries).toBe(2);

      await remove('key1');
      stats = await getStats();
      expect(stats.totalEntries).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle CacheError', async () => {
      // This test verifies error types exist and can be thrown
      expect(() => {
        throw new CacheError('Test error');
      }).toThrow(CacheError);
    });

    it('should handle CacheQuotaExceededError', async () => {
      expect(() => {
        throw new CacheQuotaExceededError();
      }).toThrow(CacheQuotaExceededError);
    });

    it('CacheQuotaExceededError should extend CacheError', () => {
      const error = new CacheQuotaExceededError();
      expect(error).toBeInstanceOf(CacheError);
      expect(error.name).toBe('CacheQuotaExceededError');
      expect(error.message).toBe('Cache quota exceeded');
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple types with same key', async () => {
      // Different types can have same key
      await set('data', 'firmware-data', 'firmware');
      await set('data', 'payload-data', 'payload');

      // Keys are global, so last write wins
      const result = await get<string>('data');
      expect(result).toBe('payload-data');
    });

    it('should handle large objects', async () => {
      const largeObject = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          data: `Data for item ${i}`,
        })),
      };

      await set('large', largeObject, 'github-releases');
      const retrieved = await get<typeof largeObject>('large');

      expect(retrieved).toEqual(largeObject);
      expect(retrieved?.items.length).toBe(1000);
    });

    it('should handle concurrent operations', async () => {
      // Set multiple entries concurrently
      await Promise.all([
        set('key1', 'data1', 'firmware'),
        set('key2', 'data2', 'payload'),
        set('key3', 'data3', 'github-releases'),
      ]);

      // Get multiple entries concurrently
      const results = await Promise.all([
        get<string>('key1'),
        get<string>('key2'),
        get<string>('key3'),
      ]);

      expect(results).toEqual(['data1', 'data2', 'data3']);
    });

    it('should maintain data integrity across operations', async () => {
      // Add initial data
      await set('key1', 'data1', 'firmware');
      await set('key2', 'data2', 'firmware');
      await set('key3', 'data3', 'payload');

      // Clear firmware type
      await clearType('firmware');

      // Verify payload data is intact
      expect(await get('key3')).toBe('data3');

      // Add new data
      await set('key4', 'data4', 'firmware');
      expect(await get('key4')).toBe('data4');

      // Verify stats
      const stats = await getStats();
      expect(stats.totalEntries).toBe(2); // key3 and key4
      expect(stats.byType.firmware).toBe(1);
      expect(stats.byType.payload).toBe(1);
    });
  });
});
