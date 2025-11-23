/**
 * Tests for TAR Extractor
 *
 * REQ-051: TAR extractor using modern-tar
 * Target coverage: >80%
 *
 * Note: These tests use uncompressed TAR for simplicity.
 * XZ decompression is tested in integration tests with real files.
 */

import { describe, test, expect } from 'vitest';
import {
  listTarContents,
  extractFromTarByName,
  TarExtractionError,
} from '../../../../src/lib/archive/tar-extractor';
import {
  createMockTar,
  createMockTarWithDirectories,
  createEmptyTar,
  createCorruptedTar,
} from '../../../mocks/archive-mocks';

describe('TAR Extractor', () => {
  describe('listTarContents', () => {
    test('lists all files in TAR', async () => {
      const tar = createMockTar();
      const files = await listTarContents(tar);

      expect(files).toContain('swiss_r1957.dol');
      expect(files).toContain('README.txt');
      expect(files.length).toBe(2);
    });

    test('lists files in nested directories', async () => {
      const tar = createMockTarWithDirectories();
      const files = await listTarContents(tar);

      expect(files).toContain('DOL/swiss_r1957.dol');
      expect(files).toContain('DOL/cubiboot.dol');
      expect(files.length).toBe(2);
    });

    test('returns empty array for empty TAR', async () => {
      const tar = createEmptyTar();
      const files = await listTarContents(tar);

      expect(files).toEqual([]);
    });
  });

  describe('extractFromTarByName', () => {
    test('extracts file by exact name', async () => {
      const tar = createMockTar();
      const result = await extractFromTarByName(tar, 'swiss_r1957.dol');

      expect(result).toBeInstanceOf(Uint8Array);
      const text = new TextDecoder().decode(result);
      expect(text).toBe('MOCK_SWISS_TAR_CONTENT');
    });

    test('extracts nested file', async () => {
      const tar = createMockTarWithDirectories();
      const result = await extractFromTarByName(tar, 'DOL/swiss_r1957.dol');

      expect(result).toBeInstanceOf(Uint8Array);
      const text = new TextDecoder().decode(result);
      expect(text).toBe('MOCK_SWISS_NESTED_TAR');
    });

    test('throws TarExtractionError when file not found', async () => {
      const tar = createMockTar();

      await expect(extractFromTarByName(tar, 'nonexistent.dol')).rejects.toThrow(
        TarExtractionError
      );
      await expect(extractFromTarByName(tar, 'nonexistent.dol')).rejects.toThrow(
        'No file matching pattern'
      );
    });

    test('filename matching is exact', async () => {
      const tar = createMockTar();

      await expect(extractFromTarByName(tar, 'SWISS_R1957.DOL')).rejects.toThrow(
        TarExtractionError
      );
    });

    test('handles empty TAR', async () => {
      const tar = createEmptyTar();

      await expect(extractFromTarByName(tar, 'any.file')).rejects.toThrow(TarExtractionError);
    });
  });

  describe('Error Handling', () => {
    test('TarExtractionError has correct name', () => {
      const error = new TarExtractionError('test error');

      expect(error.name).toBe('TarExtractionError');
      expect(error.message).toBe('test error');
    });

    test('TarExtractionError supports cause', () => {
      const cause = new Error('original error');
      const error = new TarExtractionError('wrapped error', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('Performance', () => {
    test('extraction is efficient', async () => {
      const tar = createMockTar();
      const startTime = performance.now();
      await extractFromTarByName(tar, 'swiss_r1957.dol');
      const duration = performance.now() - startTime;

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });

    test('listing is efficient', async () => {
      const tar = createMockTar();
      const startTime = performance.now();
      await listTarContents(tar);
      const duration = performance.now() - startTime;

      // Should complete in under 50ms
      expect(duration).toBeLessThan(50);
    });
  });
});
