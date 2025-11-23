/**
 * UF2 Merger - Combines Base Firmware and Payload
 *
 * Merges two UF2 files (base PicoBoot firmware + payload) into a single
 * flashable firmware file.
 *
 * Process:
 * 1. Parse both UF2 files into blocks
 * 2. Validate memory layout (no overlaps)
 * 3. Combine all blocks
 * 4. Renumber block sequences
 * 5. Serialize back to UF2 format
 *
 * Memory Layout:
 * - Base: 0x10000000 - 0x10080000 (512 KB flash)
 * - Payload: 0x10080000 - 0x10200000 (~1.5 MB)
 */

import { MEMORY_LAYOUT } from './uf2-encoder';

/**
 * UF2 Block structure (512 bytes)
 */
export interface UF2Block {
  magicStart0: number;    // 0x0A324655
  magicStart1: number;    // 0x9E5D5157
  flags: number;
  targetAddr: number;     // Target memory address
  payloadSize: number;    // Payload size (typically 256)
  blockNo: number;        // Block sequence number
  numBlocks: number;      // Total number of blocks
  familyID: number;       // Platform family ID
  data: Uint8Array;       // Block data (256 bytes)
  magicEnd: number;       // 0x0AB16F30
}

/**
 * Result of merging two UF2 files
 */
export interface MergeResult {
  data: Uint8Array;       // Merged UF2 data
  totalBlocks: number;    // Total number of blocks
  baseBlocks: number;     // Number of blocks from base
  payloadBlocks: number;  // Number of blocks from payload
}

const BLOCK_SIZE = 512;
const PAYLOAD_SIZE = 256;

/**
 * Merges base firmware and payload UF2 files
 *
 * @param baseFirmware - Base PicoBoot firmware (UF2)
 * @param payloadFirmware - Payload firmware (UF2)
 * @returns Merged firmware ready for flashing
 */
export function mergeUF2(baseFirmware: Uint8Array, payloadFirmware: Uint8Array): MergeResult {
  // Parse both files into blocks
  const baseBlocks = parseUF2Blocks(baseFirmware);
  const payloadBlocks = parseUF2Blocks(payloadFirmware);

  // Validate memory layout
  validateMemoryLayout(baseBlocks, payloadBlocks);

  // Combine blocks (base first, then payload)
  const allBlocks = [...baseBlocks, ...payloadBlocks];

  // Renumber blocks sequentially
  const renumbered = renumberBlocks(allBlocks);

  // Serialize back to UF2 format
  const mergedData = serializeBlocks(renumbered);

  return {
    data: mergedData,
    totalBlocks: renumbered.length,
    baseBlocks: baseBlocks.length,
    payloadBlocks: payloadBlocks.length,
  };
}

/**
 * Parses UF2 data into blocks
 *
 * @param uf2Data - UF2-encoded data
 * @returns Array of parsed blocks
 */
export function parseUF2Blocks(uf2Data: Uint8Array): UF2Block[] {
  // Validate size
  if (uf2Data.byteLength % BLOCK_SIZE !== 0) {
    throw new Error(
      `Invalid UF2 data size: ${uf2Data.byteLength} bytes (must be multiple of ${BLOCK_SIZE})`
    );
  }

  const blockCount = uf2Data.byteLength / BLOCK_SIZE;
  const blocks: UF2Block[] = [];

  for (let i = 0; i < blockCount; i++) {
    const offset = i * BLOCK_SIZE;
    const blockData = uf2Data.slice(offset, offset + BLOCK_SIZE);
    const block = parseBlock(blockData);
    blocks.push(block);
  }

  return blocks;
}

/**
 * Parses a single UF2 block
 *
 * @param blockData - 512-byte block
 * @returns Parsed block
 */
function parseBlock(blockData: Uint8Array): UF2Block {
  if (blockData.byteLength !== BLOCK_SIZE) {
    throw new Error(`Invalid block size: ${blockData.byteLength}`);
  }

  const view = new DataView(blockData.buffer, blockData.byteOffset);

  // Read header
  const magicStart0 = view.getUint32(0, true);   // Little-endian
  const magicStart1 = view.getUint32(4, true);
  const flags = view.getUint32(8, true);
  const targetAddr = view.getUint32(12, true);
  const payloadSize = view.getUint32(16, true);
  const blockNo = view.getUint32(20, true);
  const numBlocks = view.getUint32(24, true);
  const familyID = view.getUint32(28, true);

  // Extract payload data (256 bytes at offset 32)
  const data = blockData.slice(32, 32 + PAYLOAD_SIZE);

  // Read footer
  const magicEnd = view.getUint32(508, true);

  // Validate magic numbers
  if (magicStart0 !== 0x0A324655 || magicStart1 !== 0x9E5D5157 || magicEnd !== 0x0AB16F30) {
    throw new Error('Invalid UF2 block: bad magic numbers');
  }

  return {
    magicStart0,
    magicStart1,
    flags,
    targetAddr,
    payloadSize,
    blockNo,
    numBlocks,
    familyID,
    data,
    magicEnd,
  };
}

/**
 * Validates memory layout of base and payload
 *
 * Ensures:
 * - No memory overlap between base and payload
 * - Base is in flash region (0x10000000 - 0x10080000)
 * - Payload is in payload region (0x10080000+)
 *
 * @param baseBlocks - Base firmware blocks
 * @param payloadBlocks - Payload blocks
 */
export function validateMemoryLayout(baseBlocks: UF2Block[], payloadBlocks: UF2Block[]): void {
  if (baseBlocks.length === 0 || payloadBlocks.length === 0) {
    return;
  }

  // Find base memory range
  const baseStart = Math.min(...baseBlocks.map(b => b.targetAddr));
  const baseEnd = Math.max(...baseBlocks.map(b => b.targetAddr + b.payloadSize));

  // Find payload memory range
  const payloadStart = Math.min(...payloadBlocks.map(b => b.targetAddr));
  const payloadEnd = Math.max(...payloadBlocks.map(b => b.targetAddr + b.payloadSize));

  // Check for overlap
  if (baseEnd > payloadStart && baseStart < payloadEnd) {
    throw new Error(
      `Memory overlap detected: ` +
      `base [0x${baseStart.toString(16)} - 0x${baseEnd.toString(16)}], ` +
      `payload [0x${payloadStart.toString(16)} - 0x${payloadEnd.toString(16)}]`
    );
  }

  // Validate base is in flash region
  if (baseStart < MEMORY_LAYOUT.FLASH_BASE) {
    throw new Error(
      `Base firmware starts before flash region: 0x${baseStart.toString(16)}`
    );
  }

  // Validate payload is in payload region (or at least after base)
  if (payloadStart < baseEnd) {
    throw new Error(
      `Payload starts before base firmware ends: ` +
      `payload 0x${payloadStart.toString(16)}, base ends at 0x${baseEnd.toString(16)}`
    );
  }
}

/**
 * Renumbers blocks sequentially
 *
 * Updates blockNo (0, 1, 2, ...) and numBlocks (total count) in all blocks
 *
 * @param blocks - Blocks to renumber
 * @returns Renumbered blocks
 */
export function renumberBlocks(blocks: UF2Block[]): UF2Block[] {
  const totalBlocks = blocks.length;

  return blocks.map((block, index) => ({
    ...block,
    blockNo: index,
    numBlocks: totalBlocks,
  }));
}

/**
 * Serializes blocks back to UF2 format
 *
 * @param blocks - Blocks to serialize
 * @returns UF2-encoded data
 */
function serializeBlocks(blocks: UF2Block[]): Uint8Array {
  const result = new Uint8Array(blocks.length * BLOCK_SIZE);

  blocks.forEach((block, index) => {
    const offset = index * BLOCK_SIZE;
    const blockData = serializeBlock(block);
    result.set(blockData, offset);
  });

  return result;
}

/**
 * Serializes a single block to 512 bytes
 *
 * @param block - Block to serialize
 * @returns 512-byte block data
 */
function serializeBlock(block: UF2Block): Uint8Array {
  const result = new Uint8Array(BLOCK_SIZE);
  const view = new DataView(result.buffer);

  // Write header (32 bytes)
  view.setUint32(0, block.magicStart0, true);   // 0x0A324655
  view.setUint32(4, block.magicStart1, true);   // 0x9E5D5157
  view.setUint32(8, block.flags, true);
  view.setUint32(12, block.targetAddr, true);
  view.setUint32(16, block.payloadSize, true);
  view.setUint32(20, block.blockNo, true);
  view.setUint32(24, block.numBlocks, true);
  view.setUint32(28, block.familyID, true);

  // Write data (256 bytes at offset 32)
  result.set(block.data, 32);

  // Padding (476 - 256 = 220 bytes) is implicit (zeros)

  // Write footer (4 bytes at offset 508)
  view.setUint32(508, block.magicEnd, true);    // 0x0AB16F30

  return result;
}
