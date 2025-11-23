/**
 * ZIP Archive Extractor
 *
 * Uses @zip.js/zip.js for extracting DOL files from ZIP archives.
 * Supports:
 * - Extraction by exact filename
 * - Extraction by regex pattern
 * - Nested directory handling
 * - Error handling for corrupted archives
 *
 * @module lib/archive/zip-extractor
 */

import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js';

/**
 * Error thrown when ZIP extraction fails
 */
export class ZipExtractionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ZipExtractionError';
  }
}

/**
 * Error thrown when file not found in archive
 */
export class FileNotFoundError extends Error {
  constructor(filename: string) {
    super(`File not found in ZIP archive: ${filename}`);
    this.name = 'FileNotFoundError';
  }
}

/**
 * Extracts a single file from ZIP archive by exact filename
 *
 * @param zipData - ZIP archive as Uint8Array
 * @param filename - Exact filename to extract (case-sensitive)
 * @returns Extracted file as Uint8Array
 * @throws {ZipExtractionError} If extraction fails
 * @throws {FileNotFoundError} If file not found in archive
 *
 * @example
 * ```typescript
 * const zip = await fetch('gekkoboot.zip').then(r => r.arrayBuffer());
 * const dol = await extractFromZip(new Uint8Array(zip), 'gekkoboot.dol');
 * ```
 */
export async function extractFromZip(
  zipData: Uint8Array,
  filename: string
): Promise<Uint8Array> {
  try {
    const buffer = zipData.buffer as ArrayBuffer;
    const blob = new Blob([buffer]);
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();

    // Find exact filename match
    const entry = entries.find((e) => e.filename === filename);
    if (!entry) {
      await reader.close();
      throw new FileNotFoundError(filename);
    }

    // Extract file data (skip directories)
    if (entry.directory) {
      await reader.close();
      throw new ZipExtractionError(`Cannot extract directory: ${filename}`);
    }

    const data = await entry.getData!(new BlobWriter());
    await reader.close();

    // Convert Blob to Uint8Array
    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    if (error instanceof FileNotFoundError || error instanceof ZipExtractionError) {
      throw error;
    }
    throw new ZipExtractionError(
      `Failed to extract file from ZIP: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Extracts first file matching regex pattern from ZIP archive
 *
 * @param zipData - ZIP archive as Uint8Array
 * @param pattern - Regex pattern to match filename
 * @returns Extracted file as Uint8Array
 * @throws {ZipExtractionError} If extraction fails
 * @throws {FileNotFoundError} If no matching file found
 *
 * @example
 * ```typescript
 * // Extract any .dol file
 * const dol = await extractFromZipByPattern(zipData, /\.dol$/);
 *
 * // Extract Swiss-GC DOL from nested directory
 * const swiss = await extractFromZipByPattern(zipData, /DOL\/swiss.*\.dol$/);
 * ```
 */
export async function extractFromZipByPattern(
  zipData: Uint8Array,
  pattern: RegExp
): Promise<Uint8Array> {
  try {
    const buffer = zipData.buffer as ArrayBuffer;
    const blob = new Blob([buffer]);
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();

    // Find first matching entry (skip directories)
    const entry = entries.find((e) => !e.directory && pattern.test(e.filename));
    if (!entry) {
      await reader.close();
      throw new FileNotFoundError(`No file matching pattern: ${pattern.source}`);
    }

    // Extract file data
    if (!('getData' in entry)) {
      await reader.close();
      throw new ZipExtractionError(`Cannot extract data from ${entry.filename}`);
    }
    const data = await entry.getData(new BlobWriter());
    await reader.close();

    // Convert Blob to Uint8Array
    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    if (error instanceof FileNotFoundError || error instanceof ZipExtractionError) {
      throw error;
    }
    throw new ZipExtractionError(
      `Failed to extract file from ZIP: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Lists all files in ZIP archive
 *
 * @param zipData - ZIP archive as Uint8Array
 * @returns Array of filenames
 * @throws {ZipExtractionError} If reading archive fails
 *
 * @example
 * ```typescript
 * const files = await listZipContents(zipData);
 * console.log('Files in archive:', files);
 * // ['gekkoboot.dol', 'README.txt', 'docs/manual.pdf']
 * ```
 */
export async function listZipContents(zipData: Uint8Array): Promise<string[]> {
  try {
    const buffer = zipData.buffer as ArrayBuffer;
    const blob = new Blob([buffer]);
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    const filenames = entries.map((e) => e.filename);
    await reader.close();
    return filenames;
  } catch (error) {
    throw new ZipExtractionError(
      `Failed to list ZIP contents: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Checks if file exists in ZIP archive
 *
 * @param zipData - ZIP archive as Uint8Array
 * @param filename - Filename to check
 * @returns True if file exists
 * @throws {ZipExtractionError} If reading archive fails
 */
export async function hasFile(zipData: Uint8Array, filename: string): Promise<boolean> {
  try {
    const buffer = zipData.buffer as ArrayBuffer;
    const blob = new Blob([buffer]);
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    const exists = entries.some((e) => e.filename === filename);
    await reader.close();
    return exists;
  } catch (error) {
    throw new ZipExtractionError(
      `Failed to check ZIP contents: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

