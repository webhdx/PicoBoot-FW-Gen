/**
 * TAR.XZ Archive Extractor
 *
 * Uses xz-decompress for XZ decompression and modern-tar for TAR extraction.
 * Handles large files like Swiss-GC (6.6 MB compressed).
 *
 * @module lib/archive/tar-extractor
 */

import { XzReadableStream } from 'xz-decompress';
import { createTarDecoder } from 'modern-tar';

/**
 * Error thrown when TAR.XZ extraction fails
 */
export class TarExtractionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TarExtractionError';
  }
}

/**
 * TAR entry representation
 */
export interface TarEntry {
  name: string;
  type: string;
  size: number;
  data?: Uint8Array;
}

/**
 * Extracts first file matching pattern from TAR.XZ archive
 *
 * @param tarXzData - TAR.XZ archive as Uint8Array
 * @param pattern - Regex pattern to match filename
 * @param onProgress - Optional progress callback (bytes processed)
 * @returns Extracted file as Uint8Array
 * @throws {TarExtractionError} If extraction fails or file not found
 *
 * @example
 * ```typescript
 * // Extract Swiss-GC DOL
 * const swiss = await extractFromTarXz(
 *   tarxzData,
 *   /DOL\/swiss.*\.dol$/,
 *   (bytes) => console.log(`Processed: ${bytes} bytes`)
 * );
 * ```
 */
export async function extractFromTarXz(
  tarXzData: Uint8Array,
  pattern: RegExp,
  onProgress?: (bytesProcessed: number) => void
): Promise<Uint8Array> {
  try {
    // Step 1: XZ decompression
    const xzStream = createXzDecompressionStream(tarXzData);

    // Step 2: TAR parsing
    const tarEntries = await parseTarStream(xzStream, onProgress);

    // Step 3: Find matching file
    const entry = tarEntries.find((e) => pattern.test(e.name));
    if (!entry || !entry.data) {
      throw new TarExtractionError(`No file matching pattern: ${pattern.source}`);
    }

    return entry.data;
  } catch (error) {
    if (error instanceof TarExtractionError) {
      throw error;
    }
    throw new TarExtractionError(
      `Failed to extract from TAR.XZ: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Lists all files in TAR.XZ archive
 *
 * @param tarXzData - TAR.XZ archive as Uint8Array
 * @returns Array of filenames
 * @throws {TarExtractionError} If reading archive fails
 */
export async function listTarXzContents(tarXzData: Uint8Array): Promise<string[]> {
  try {
    const xzStream = createXzDecompressionStream(tarXzData);
    const tarEntries = await parseTarStream(xzStream);
    return tarEntries.map((e) => e.name);
  } catch (error) {
    throw new TarExtractionError(
      `Failed to list TAR.XZ contents: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Lists all files in uncompressed TAR archive (for testing)
 *
 * @param tarData - TAR archive as Uint8Array (no XZ compression)
 * @returns Array of filenames
 * @throws {TarExtractionError} If reading archive fails
 */
export async function listTarContents(tarData: Uint8Array): Promise<string[]> {
  try {
    const tarStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(tarData);
        controller.close();
      },
    });
    const tarEntries = await parseTarStream(tarStream);
    return tarEntries.map((e) => e.name);
  } catch (error) {
    throw new TarExtractionError(
      `Failed to list TAR contents: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Extracts a single file by exact name from TAR.XZ
 *
 * @param tarXzData - TAR.XZ archive as Uint8Array
 * @param filename - Exact filename to extract
 * @returns Extracted file as Uint8Array
 * @throws {TarExtractionError} If file not found or extraction fails
 */
export async function extractFromTarXzByName(
  tarXzData: Uint8Array,
  filename: string
): Promise<Uint8Array> {
  return extractFromTarXz(tarXzData, new RegExp(`^${escapeRegex(filename)}$`));
}

/**
 * Extracts file from uncompressed TAR archive (for testing)
 *
 * @param tarData - TAR archive as Uint8Array (no XZ compression)
 * @param pattern - Regex pattern to match filename
 * @returns Extracted file as Uint8Array
 * @throws {TarExtractionError} If file not found or extraction fails
 */
export async function extractFromTar(
  tarData: Uint8Array,
  pattern: RegExp
): Promise<Uint8Array> {
  try {
    const tarStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(tarData);
        controller.close();
      },
    });
    const tarEntries = await parseTarStream(tarStream);

    const entry = tarEntries.find((e) => pattern.test(e.name));
    if (!entry || !entry.data) {
      throw new TarExtractionError(`No file matching pattern: ${pattern.source}`);
    }

    return entry.data;
  } catch (error) {
    if (error instanceof TarExtractionError) {
      throw error;
    }
    throw new TarExtractionError(
      `Failed to extract from TAR: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Extracts file by exact name from uncompressed TAR (for testing)
 *
 * @param tarData - TAR archive as Uint8Array (no XZ compression)
 * @param filename - Exact filename to extract
 * @returns Extracted file as Uint8Array
 * @throws {TarExtractionError} If file not found or extraction fails
 */
export async function extractFromTarByName(
  tarData: Uint8Array,
  filename: string
): Promise<Uint8Array> {
  return extractFromTar(tarData, new RegExp(`^${escapeRegex(filename)}$`));
}

/**
 * Creates XZ decompression stream from Uint8Array
 *
 * @param xzData - XZ compressed data
 * @returns ReadableStream with decompressed data
 */
function createXzDecompressionStream(xzData: Uint8Array): ReadableStream<Uint8Array> {
  // Create a ReadableStream from Uint8Array
  const inputStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(xzData);
      controller.close();
    },
  });

  // Apply XZ decompression via TransformStream
  const xzTransform = new XzReadableStream({} as any);
  return inputStream.pipeThrough(xzTransform as any);
}

/**
 * Parses TAR stream and extracts all entries
 *
 * @param tarStream - Decompressed TAR data stream
 * @param onProgress - Optional progress callback
 * @returns Array of TAR entries with data
 */
async function parseTarStream(
  tarStream: ReadableStream<Uint8Array>,
  onProgress?: (bytesProcessed: number) => void
): Promise<TarEntry[]> {
  const entries: TarEntry[] = [];
  let bytesProcessed = 0;

  try {
    // Use modern-tar's createTarDecoder to parse TAR format
    const tarDecoder = createTarDecoder();
    const decodedStream = tarStream.pipeThrough(tarDecoder);

    // Iterate through decoded entries
    for await (const tarEntry of decodedStream as any) {
      const entry: TarEntry = {
        name: tarEntry.header.name as string,
        type: tarEntry.header.type as string,
        size: tarEntry.header.size as number,
      };

      // Read file data if it's a regular file
      if (entry.type === 'file') {
        const chunks: Uint8Array[] = [];
        const reader = tarEntry.body.getReader();

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value as Uint8Array);
          bytesProcessed += (value as Uint8Array).byteLength;

          if (onProgress) {
            onProgress(bytesProcessed);
          }
        }

        // Combine chunks into single Uint8Array
        entry.data = concatenateUint8Arrays(chunks);
      } else {
        // For non-file entries (directories, etc.), drain the body
        await tarEntry.body.cancel();
      }

      entries.push(entry);
    }

    return entries;
  } catch (error) {
    throw new TarExtractionError(
      `Failed to parse TAR stream: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

/**
 * Concatenates multiple Uint8Arrays into one
 *
 * @param arrays - Array of Uint8Arrays to concatenate
 * @returns Single concatenated Uint8Array
 */
function concatenateUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.byteLength, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.byteLength;
  }

  return result;
}

/**
 * Escapes special regex characters in string
 *
 * @param str - String to escape
 * @returns Escaped string safe for regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
