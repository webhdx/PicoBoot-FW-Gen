/**
 * Tests for ZIP Extractor
 *
 * REQ-050: ZIP extractor using @zip.js/zip.js
 * Target coverage: >80%
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  extractFromZip,
  extractFromZipByPattern,
  listZipContents,
  hasFile,
  ZipExtractionError,
  FileNotFoundError,
} from '../../../../src/lib/archive/zip-extractor';
import {
  createMockZip,
  createMockZipWithDirectories,
  createEmptyZip,
  createCorruptedZip,
} from '../../../mocks/archive-mocks';

describe('ZIP Extractor', () => {
  let mockZip: Uint8Array;
  let mockZipWithDirs: Uint8Array;
  let emptyZip: Uint8Array;

  beforeEach(async () => {
    mockZip = await createMockZip();
    mockZipWithDirs = await createMockZipWithDirectories();
    emptyZip = await createEmptyZip();
  });

  describe('extractFromZip', () => {
    test('extracts file by exact filename', async () => {
      const result = await extractFromZip(mockZip, 'gekkoboot.dol');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBeGreaterThan(0);

      // Verify content
      const text = new TextDecoder().decode(result);
      expect(text).toBe('MOCK_DOL_CONTENT_GEKKOBOOT');
    });

    test('extracts nested file', async () => {
      const result = await extractFromZip(mockZip, 'docs/manual.pdf');

      expect(result).toBeInstanceOf(Uint8Array);
      const text = new TextDecoder().decode(result);
      expect(text).toBe('MOCK_PDF_CONTENT');
    });

    test('throws FileNotFoundError when file does not exist', async () => {
      await expect(extractFromZip(mockZip, 'nonexistent.dol')).rejects.toThrow(
        FileNotFoundError
      );
      await expect(extractFromZip(mockZip, 'nonexistent.dol')).rejects.toThrow(
        'File not found in ZIP archive: nonexistent.dol'
      );
    });

    test('throws error when trying to extract directory', async () => {
      await expect(extractFromZip(mockZipWithDirs, 'DOL/')).rejects.toThrow(
        ZipExtractionError
      );
      await expect(extractFromZip(mockZipWithDirs, 'DOL/')).rejects.toThrow(
        'Cannot extract directory'
      );
    });

    test('handles empty ZIP archive', async () => {
      await expect(extractFromZip(emptyZip, 'any.file')).rejects.toThrow(FileNotFoundError);
    });

    test('throws ZipExtractionError for corrupted ZIP', async () => {
      const corruptedZip = createCorruptedZip();
      await expect(extractFromZip(corruptedZip, 'any.file')).rejects.toThrow(
        ZipExtractionError
      );
    });

    test('filename matching is case-sensitive', async () => {
      await expect(extractFromZip(mockZip, 'GEKKOBOOT.DOL')).rejects.toThrow(
        FileNotFoundError
      );
    });
  });

  describe('extractFromZipByPattern', () => {
    test('extracts file matching .dol pattern', async () => {
      const result = await extractFromZipByPattern(mockZip, /\.dol$/);

      expect(result).toBeInstanceOf(Uint8Array);
      const text = new TextDecoder().decode(result);
      expect(text).toBe('MOCK_DOL_CONTENT_GEKKOBOOT');
    });

    test('extracts first matching file when multiple matches', async () => {
      const result = await extractFromZipByPattern(mockZipWithDirs, /\.dol$/);

      expect(result).toBeInstanceOf(Uint8Array);
      const text = new TextDecoder().decode(result);
      // Should match first .dol file (swiss_r1957.dol or cubiboot.dol)
      expect(text).toMatch(/MOCK_(SWISS|CUBIBOOT)_DOL_CONTENT/);
    });

    test('extracts file from nested directory with pattern', async () => {
      const result = await extractFromZipByPattern(mockZipWithDirs, /DOL\/swiss.*\.dol$/);

      expect(result).toBeInstanceOf(Uint8Array);
      const text = new TextDecoder().decode(result);
      expect(text).toBe('MOCK_SWISS_DOL_CONTENT');
    });

    test('supports complex regex patterns', async () => {
      const result = await extractFromZipByPattern(mockZip, /^docs\/.*\.pdf$/);

      expect(result).toBeInstanceOf(Uint8Array);
      const text = new TextDecoder().decode(result);
      expect(text).toBe('MOCK_PDF_CONTENT');
    });

    test('throws FileNotFoundError when no match found', async () => {
      await expect(extractFromZipByPattern(mockZip, /\.exe$/)).rejects.toThrow(
        FileNotFoundError
      );
      await expect(extractFromZipByPattern(mockZip, /\.exe$/)).rejects.toThrow(
        'No file matching pattern'
      );
    });

    test('skips directories when matching pattern', async () => {
      // Even though DOL/ matches /DOL/, it should be skipped
      const result = await extractFromZipByPattern(mockZipWithDirs, /DOL\//);

      expect(result).toBeInstanceOf(Uint8Array);
      // Should match a file, not the directory
      const text = new TextDecoder().decode(result);
      expect(text).toMatch(/MOCK_(SWISS|CUBIBOOT)_DOL_CONTENT/);
    });

    test('handles empty ZIP archive', async () => {
      await expect(extractFromZipByPattern(emptyZip, /\.dol$/)).rejects.toThrow(
        FileNotFoundError
      );
    });

    test('throws ZipExtractionError for corrupted ZIP', async () => {
      const corruptedZip = createCorruptedZip();
      await expect(extractFromZipByPattern(corruptedZip, /\.dol$/)).rejects.toThrow(
        ZipExtractionError
      );
    });
  });

  describe('listZipContents', () => {
    test('lists all files in ZIP', async () => {
      const files = await listZipContents(mockZip);

      expect(files).toEqual(['gekkoboot.dol', 'README.txt', 'docs/manual.pdf']);
    });

    test('includes directories in listing', async () => {
      const files = await listZipContents(mockZipWithDirs);

      expect(files).toContain('DOL/');
      expect(files).toContain('DOL/swiss_r1957.dol');
      expect(files).toContain('DOL/cubiboot.dol');
    });

    test('returns empty array for empty ZIP', async () => {
      const files = await listZipContents(emptyZip);

      expect(files).toEqual([]);
    });

    test('throws ZipExtractionError for corrupted ZIP', async () => {
      const corruptedZip = createCorruptedZip();
      await expect(listZipContents(corruptedZip)).rejects.toThrow(ZipExtractionError);
    });

    test('preserves file order', async () => {
      const files = await listZipContents(mockZip);

      expect(files[0]).toBe('gekkoboot.dol');
      expect(files[1]).toBe('README.txt');
      expect(files[2]).toBe('docs/manual.pdf');
    });
  });

  describe('hasFile', () => {
    test('returns true when file exists', async () => {
      const exists = await hasFile(mockZip, 'gekkoboot.dol');

      expect(exists).toBe(true);
    });

    test('returns true for nested files', async () => {
      const exists = await hasFile(mockZip, 'docs/manual.pdf');

      expect(exists).toBe(true);
    });

    test('returns false when file does not exist', async () => {
      const exists = await hasFile(mockZip, 'nonexistent.dol');

      expect(exists).toBe(false);
    });

    test('returns false for empty ZIP', async () => {
      const exists = await hasFile(emptyZip, 'any.file');

      expect(exists).toBe(false);
    });

    test('checking is case-sensitive', async () => {
      const exists = await hasFile(mockZip, 'GEKKOBOOT.DOL');

      expect(exists).toBe(false);
    });

    test('returns true for directories', async () => {
      const exists = await hasFile(mockZipWithDirs, 'DOL/');

      expect(exists).toBe(true);
    });

    test('throws ZipExtractionError for corrupted ZIP', async () => {
      const corruptedZip = createCorruptedZip();
      await expect(hasFile(corruptedZip, 'any.file')).rejects.toThrow(ZipExtractionError);
    });
  });

  describe('Error Handling', () => {
    test('ZipExtractionError includes cause', async () => {
      const corruptedZip = createCorruptedZip();

      try {
        await extractFromZip(corruptedZip, 'test.dol');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ZipExtractionError);
        const zipError = error as ZipExtractionError;
        expect(zipError.cause).toBeDefined();
      }
    });

    test('FileNotFoundError has correct message format', () => {
      const error = new FileNotFoundError('test.dol');

      expect(error.name).toBe('FileNotFoundError');
      expect(error.message).toBe('File not found in ZIP archive: test.dol');
    });

    test('ZipExtractionError preserves error chain', async () => {
      const corruptedZip = createCorruptedZip();

      try {
        await extractFromZipByPattern(corruptedZip, /\.dol$/);
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ZipExtractionError);
        expect((error as ZipExtractionError).message).toContain('Failed to extract file from ZIP');
      }
    });
  });

  describe('Performance', () => {
    test('extracts files efficiently', async () => {
      const startTime = performance.now();
      await extractFromZip(mockZip, 'gekkoboot.dol');
      const duration = performance.now() - startTime;

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });

    test('pattern matching is efficient', async () => {
      const startTime = performance.now();
      await extractFromZipByPattern(mockZip, /\.dol$/);
      const duration = performance.now() - startTime;

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});
