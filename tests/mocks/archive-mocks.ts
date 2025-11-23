/**
 * Mock archive files for testing extractors
 */

import { ZipWriter, BlobWriter, TextReader } from '@zip.js/zip.js';

/**
 * Creates a mock ZIP archive with test files
 */
export async function createMockZip(): Promise<Uint8Array> {
  const blobWriter = new BlobWriter();
  const zipWriter = new ZipWriter(blobWriter);

  // Add gekkoboot.dol (mock DOL file)
  await zipWriter.add('gekkoboot.dol', new TextReader('MOCK_DOL_CONTENT_GEKKOBOOT'));

  // Add README.txt
  await zipWriter.add('README.txt', new TextReader('This is a mock ZIP archive for testing'));

  // Add nested file
  await zipWriter.add('docs/manual.pdf', new TextReader('MOCK_PDF_CONTENT'));

  await zipWriter.close();
  const blob = await blobWriter.getData();
  const arrayBuffer = await blob.arrayBuffer();

  return new Uint8Array(arrayBuffer);
}

/**
 * Creates a mock ZIP archive with directory structure
 */
export async function createMockZipWithDirectories(): Promise<Uint8Array> {
  const blobWriter = new BlobWriter();
  const zipWriter = new ZipWriter(blobWriter);

  // Add directory (directory entries have trailing slash)
  await zipWriter.add('DOL/', undefined, { directory: true });
  await zipWriter.add('DOL/swiss_r1957.dol', new TextReader('MOCK_SWISS_DOL_CONTENT'));
  await zipWriter.add('DOL/cubiboot.dol', new TextReader('MOCK_CUBIBOOT_DOL_CONTENT'));

  await zipWriter.close();
  const blob = await blobWriter.getData();
  const arrayBuffer = await blob.arrayBuffer();

  return new Uint8Array(arrayBuffer);
}

/**
 * Creates an empty ZIP archive
 */
export async function createEmptyZip(): Promise<Uint8Array> {
  const blobWriter = new BlobWriter();
  const zipWriter = new ZipWriter(blobWriter);
  await zipWriter.close();
  const blob = await blobWriter.getData();
  const arrayBuffer = await blob.arrayBuffer();

  return new Uint8Array(arrayBuffer);
}

/**
 * Creates corrupted ZIP data (invalid magic bytes)
 */
export function createCorruptedZip(): Uint8Array {
  return new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00]);
}

/**
 * Creates a simple TAR archive (USTAR format) for testing
 * TAR header is 512 bytes per entry
 */
function createTarHeader(filename: string, size: number): Uint8Array {
  const header = new Uint8Array(512);

  // Filename (offset 0, 100 bytes)
  const nameBytes = new TextEncoder().encode(filename);
  header.set(nameBytes, 0);

  // File mode (offset 100, 8 bytes) - "0000644\0"
  header.set(new TextEncoder().encode('0000644\0'), 100);

  // UID (offset 108, 8 bytes)
  header.set(new TextEncoder().encode('0000000\0'), 108);

  // GID (offset 116, 8 bytes)
  header.set(new TextEncoder().encode('0000000\0'), 116);

  // File size (offset 124, 12 bytes) - octal
  const sizeOctal = size.toString(8).padStart(11, '0') + '\0';
  header.set(new TextEncoder().encode(sizeOctal), 124);

  // Modification time (offset 136, 12 bytes)
  header.set(new TextEncoder().encode('14000000000\0'), 136);

  // Checksum placeholder (offset 148, 8 bytes)
  header.set(new TextEncoder().encode('        '), 148);

  // Type flag (offset 156, 1 byte) - '0' for regular file
  header[156] = 0x30;

  // USTAR magic (offset 257, 6 bytes)
  header.set(new TextEncoder().encode('ustar\0'), 257);

  // USTAR version (offset 263, 2 bytes)
  header.set(new TextEncoder().encode('00'), 263);

  // Calculate checksum
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
  header.set(new TextEncoder().encode(checksumStr), 148);

  return header;
}

/**
 * Creates a simple TAR archive with test files (no compression)
 */
export function createMockTar(): Uint8Array {
  const files: Array<{ name: string; content: string }> = [
    { name: 'swiss_r1957.dol', content: 'MOCK_SWISS_TAR_CONTENT' },
    { name: 'README.txt', content: 'TAR archive test file' },
  ];

  const chunks: Uint8Array[] = [];

  for (const file of files) {
    const content = new TextEncoder().encode(file.content);
    const header = createTarHeader(file.name, content.byteLength);
    chunks.push(header);

    // File content must be padded to 512-byte boundary
    const paddedSize = Math.ceil(content.byteLength / 512) * 512;
    const paddedContent = new Uint8Array(paddedSize);
    paddedContent.set(content, 0);
    chunks.push(paddedContent);
  }

  // TAR files end with two 512-byte zero blocks
  chunks.push(new Uint8Array(512));
  chunks.push(new Uint8Array(512));

  // Concatenate all chunks
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const tarData = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    tarData.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return tarData;
}

/**
 * Creates a mock TAR archive with nested directories
 */
export function createMockTarWithDirectories(): Uint8Array {
  const files: Array<{ name: string; content: string }> = [
    { name: 'DOL/swiss_r1957.dol', content: 'MOCK_SWISS_NESTED_TAR' },
    { name: 'DOL/cubiboot.dol', content: 'MOCK_CUBIBOOT_NESTED_TAR' },
  ];

  const chunks: Uint8Array[] = [];

  for (const file of files) {
    const content = new TextEncoder().encode(file.content);
    const header = createTarHeader(file.name, content.byteLength);
    chunks.push(header);

    const paddedSize = Math.ceil(content.byteLength / 512) * 512;
    const paddedContent = new Uint8Array(paddedSize);
    paddedContent.set(content, 0);
    chunks.push(paddedContent);
  }

  chunks.push(new Uint8Array(512));
  chunks.push(new Uint8Array(512));

  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const tarData = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    tarData.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return tarData;
}

/**
 * Creates an empty TAR archive (just EOF markers)
 */
export function createEmptyTar(): Uint8Array {
  const tarData = new Uint8Array(1024); // Two 512-byte zero blocks
  return tarData;
}

/**
 * Creates corrupted TAR data
 */
export function createCorruptedTar(): Uint8Array {
  return new Uint8Array([0xff, 0xff, 0xff, 0xff]);
}
