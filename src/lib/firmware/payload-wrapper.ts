/**
 * Payload Wrapper - PicoBoot Protocol Format
 *
 * Wraps scrambled payload data in the format required by PicoBoot:
 * - IPLBOOT header (magic + size)
 * - Scrambled payload data
 * - 4-byte alignment padding
 * - PICO signature footer
 *
 * This module handles ONLY the protocol framing, not the cryptographic
 * scrambling itself (that's in scrambler.ts).
 *
 * Reference: https://github.com/webhdx/PicoBoot/blob/main/tools/process_ipl.py
 */

import { scramble } from './scrambler';

export interface WrappedPayload {
  header: Uint8Array;    // IPLBOOT header (12 bytes: "IPLBOOT " + 4-byte size)
  payload: Uint8Array;   // Scrambled data + padding + "PICO" signature
  totalSize: number;     // header.length + payload.length
}

const ALIGN_SIZE = 4;
const IPLBOOT_HEADER_SIZE = 32; // Full header size used in size calculation

/**
 * Wraps scrambled payload in PicoBoot protocol format
 *
 * This function:
 * 1. Scrambles the raw data using the bootrom algorithm
 * 2. Aligns to 4-byte boundary with zero padding
 * 3. Adds "PICO" signature footer
 * 4. Generates IPLBOOT header with size field
 *
 * @param data - Raw unscrambled payload data
 * @returns Wrapped payload ready for PicoBoot firmware
 */
export function wrapPayload(data: Uint8Array): WrappedPayload {
  // Step 1: Scramble the data
  const scrambled = scramble(data);

  // Step 2: Align to 4 bytes and add "PICO" signature
  const alignedSize = Math.ceil(scrambled.byteLength / ALIGN_SIZE) * ALIGN_SIZE;
  const withSignature = new Uint8Array(alignedSize + 4);

  withSignature.set(scrambled, 0);
  // Padding is implicit (zeros from new Uint8Array)

  // Add "PICO" signature at the end
  withSignature.set([0x50, 0x49, 0x43, 0x4F], alignedSize); // "PICO" in ASCII

  // Step 3: Generate IPLBOOT header
  // Size includes the payload + signature + full 32-byte header
  const totalImageSize = withSignature.byteLength + IPLBOOT_HEADER_SIZE;
  const header = createIPLBOOTHeader(totalImageSize);

  return {
    header,
    payload: withSignature,
    totalSize: header.byteLength + withSignature.byteLength,
  };
}

/**
 * Creates IPLBOOT header
 *
 * Format (returned 12 bytes, but size field assumes 32 bytes):
 * - 0x00-0x07: "IPLBOOT " (8 bytes, ASCII)
 * - 0x08-0x0B: Size (4 bytes, big-endian)
 *
 * Note: Original Python creates 32-byte header with 20 bytes padding.
 * We return only the significant 12 bytes, but the size field includes
 * the full 32-byte header size for compatibility.
 *
 * @param size - Total image size (payload + full 32-byte header)
 * @returns IPLBOOT header (12 bytes)
 */
export function createIPLBOOTHeader(size: number): Uint8Array {
  const header = new Uint8Array(12);

  // "IPLBOOT " (8 bytes) - note the trailing space
  header[0] = 0x49; // 'I'
  header[1] = 0x50; // 'P'
  header[2] = 0x4C; // 'L'
  header[3] = 0x42; // 'B'
  header[4] = 0x4F; // 'O'
  header[5] = 0x4F; // 'O'
  header[6] = 0x54; // 'T'
  header[7] = 0x20; // ' ' (space)

  // Size (4 bytes, big-endian)
  const view = new DataView(header.buffer);
  view.setUint32(8, size, false); // false = big-endian

  return header;
}

/**
 * Validates wrapped payload structure
 *
 * Checks:
 * - IPLBOOT header magic is correct
 * - Header size is 12 bytes
 * - PICO signature is present at end
 * - Total size is consistent
 *
 * @param payload - Wrapped payload to validate
 * @throws Error if validation fails
 */
export function validateWrappedPayload(payload: WrappedPayload): void {
  // Check header magic
  const magic = new TextDecoder().decode(payload.header.slice(0, 8));
  if (magic !== 'IPLBOOT ') {
    throw new Error(`Invalid IPLBOOT header magic: "${magic}"`);
  }

  // Check header size
  if (payload.header.byteLength !== 12) {
    throw new Error(`Invalid header size: ${payload.header.byteLength} (expected 12)`);
  }

  // Check PICO signature at end
  const sig = payload.payload.slice(-4);
  const sigStr = new TextDecoder().decode(sig);
  if (sigStr !== 'PICO') {
    throw new Error(`Invalid PICO signature: "${sigStr}"`);
  }

  // Check total size
  const expectedTotal = payload.header.byteLength + payload.payload.byteLength;
  if (payload.totalSize !== expectedTotal) {
    throw new Error(
      `Total size mismatch: ${payload.totalSize} vs ${expectedTotal}`
    );
  }
}

/**
 * Extracts payload size from IPLBOOT header
 *
 * @param header - IPLBOOT header (at least 12 bytes)
 * @returns Size field value (big-endian uint32 at offset 8)
 */
export function extractPayloadSize(header: Uint8Array): number {
  if (header.byteLength < 12) {
    throw new Error(`Header too small: ${header.byteLength} bytes (need at least 12)`);
  }

  const view = new DataView(header.buffer, header.byteOffset);
  return view.getUint32(8, false); // false = big-endian
}
