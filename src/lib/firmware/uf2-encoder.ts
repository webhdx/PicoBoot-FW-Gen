/**
 * UF2 Encoder - Universal Flash Format
 *
 * Wrapper around uf2gen library with PicoBoot-specific functionality.
 * Adds support for RP2350 family ID and provides type-safe API.
 *
 * UF2 Format:
 * - 512-byte blocks
 * - Magic numbers: 0x0A324655, 0x9E5D5157, 0x0AB16F30
 * - 256-byte payload per block
 * - Family ID for platform targeting
 *
 * Reference: https://github.com/microsoft/uf2
 */

import { convertBinToUf2, getUf2FamilyId } from 'uf2gen';

/**
 * Platform types supported by PicoBoot
 */
export type Platform = 'RP2040' | 'RP2350';

/**
 * UF2 Family IDs for RP2040/RP2350
 */
export const UF2_FAMILY_IDS = {
  RP2040: 0xE48BFF56,        // Raspberry Pi RP2040
  RP2350: 0xE48BFF59,        // Raspberry Pi RP2350 (ARM Secure)
} as const;

/**
 * Memory addresses for PicoBoot firmware
 */
export const MEMORY_LAYOUT = {
  FLASH_BASE: 0x10000000,     // Flash base address
  FLASH_SIZE: 0x00080000,     // 512 KB
  PAYLOAD_BASE: 0x10080000,   // Payload starts after 512 KB
  PAYLOAD_SIZE: 0x00180000,   // ~1.5 MB available for payload
} as const;

/**
 * Options for UF2 encoding
 */
export interface UF2EncodeOptions {
  platform: Platform;
  baseAddress: number;
}

/**
 * Result of UF2 encoding
 */
export interface UF2EncodeResult {
  data: Uint8Array;
  blockCount: number;
  totalSize: number;
  familyId: number;
  baseAddress: number;
}

/**
 * Encodes binary data to UF2 format
 *
 * @param data - Binary data to encode
 * @param options - Encoding options (platform, base address)
 * @returns UF2-encoded data ready for flashing
 */
export function encodeToUF2(
  data: Uint8Array,
  options: UF2EncodeOptions
): UF2EncodeResult {
  const { platform, baseAddress } = options;

  // Get family ID
  const familyId = getFamilyId(platform);

  // Convert using uf2gen library
  // Note: uf2gen only knows about RP2040, so we'll post-process for RP2350
  const uf2Data = convertBinToUf2(data, baseAddress, UF2_FAMILY_IDS.RP2040);

  // If RP2350, patch family IDs in all blocks
  const finalData = platform === 'RP2350'
    ? patchFamilyId(uf2Data, UF2_FAMILY_IDS.RP2350)
    : uf2Data;

  // Calculate block count (each block is 512 bytes)
  const blockCount = finalData.byteLength / 512;

  return {
    data: finalData,
    blockCount,
    totalSize: finalData.byteLength,
    familyId,
    baseAddress,
  };
}

/**
 * Gets UF2 family ID for platform
 *
 * @param platform - Target platform
 * @returns Family ID
 */
export function getFamilyId(platform: Platform): number {
  return UF2_FAMILY_IDS[platform];
}

/**
 * Patches family ID in all UF2 blocks
 *
 * UF2 block structure (512 bytes):
 * - Offset 28: Family ID (4 bytes, little-endian)
 *
 * @param uf2Data - UF2 data to patch
 * @param newFamilyId - New family ID to set
 * @returns Patched UF2 data
 */
function patchFamilyId(uf2Data: Uint8Array, newFamilyId: number): Uint8Array {
  const result = new Uint8Array(uf2Data);
  const blockSize = 512;
  const familyIdOffset = 28;

  // Iterate through all blocks
  for (let offset = 0; offset < result.byteLength; offset += blockSize) {
    const view = new DataView(result.buffer, result.byteOffset + offset);

    // Write new family ID at offset 28 (little-endian)
    view.setUint32(familyIdOffset, newFamilyId, true);
  }

  return result;
}

/**
 * Validates UF2 block structure
 *
 * @param block - 512-byte UF2 block
 * @returns True if block is valid
 */
export function validateUF2Block(block: Uint8Array): boolean {
  if (block.byteLength !== 512) {
    return false;
  }

  const view = new DataView(block.buffer, block.byteOffset);

  // Check magic numbers
  const magic0 = view.getUint32(0, true);  // 0x0A324655
  const magic1 = view.getUint32(4, true);  // 0x9E5D5157
  const magicEnd = view.getUint32(508, true); // 0x0AB16F30

  return (
    magic0 === 0x0A324655 &&
    magic1 === 0x9E5D5157 &&
    magicEnd === 0x0AB16F30
  );
}

/**
 * Extracts family ID from UF2 block
 *
 * @param block - 512-byte UF2 block
 * @returns Family ID
 */
export function extractFamilyId(block: Uint8Array): number {
  if (block.byteLength < 512) {
    throw new Error(`Invalid UF2 block size: ${block.byteLength} (expected 512)`);
  }

  const view = new DataView(block.buffer, block.byteOffset);
  return view.getUint32(28, true); // Little-endian
}

/**
 * Counts blocks in UF2 data
 *
 * @param uf2Data - UF2-encoded data
 * @returns Number of blocks
 */
export function countBlocks(uf2Data: Uint8Array): number {
  if (uf2Data.byteLength % 512 !== 0) {
    throw new Error(`Invalid UF2 data size: ${uf2Data.byteLength} (not multiple of 512)`);
  }

  return uf2Data.byteLength / 512;
}

/**
 * Validates entire UF2 file
 *
 * @param uf2Data - UF2-encoded data
 * @throws Error if validation fails
 */
export function validateUF2Data(uf2Data: Uint8Array): void {
  // Check size is multiple of 512
  if (uf2Data.byteLength % 512 !== 0) {
    throw new Error(
      `Invalid UF2 data size: ${uf2Data.byteLength} bytes (must be multiple of 512)`
    );
  }

  const blockCount = countBlocks(uf2Data);

  // Validate each block
  for (let i = 0; i < blockCount; i++) {
    const offset = i * 512;
    const block = uf2Data.slice(offset, offset + 512);

    if (!validateUF2Block(block)) {
      throw new Error(`Invalid UF2 block at index ${i}`);
    }
  }
}
