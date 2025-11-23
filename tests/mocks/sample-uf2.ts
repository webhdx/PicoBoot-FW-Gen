/**
 * Mock UF2 file structure for testing
 * UF2 format: 512-byte blocks
 */

export const UF2_MAGIC_START0 = 0x0A324655
export const UF2_MAGIC_START1 = 0x9E5D5157
export const UF2_MAGIC_END = 0x0AB16F30

export const FAMILY_ID_RP2040 = 0xE48BFF56
export const FAMILY_ID_RP2350 = 0xE48BFF59

export interface UF2Block {
  magicStart0: number
  magicStart1: number
  flags: number
  targetAddr: number
  payloadSize: number
  blockNo: number
  numBlocks: number
  familyID: number
  data: Uint8Array
  magicEnd: number
}

// Create a single valid UF2 block
export function createValidUF2Block(
  blockNo: number,
  numBlocks: number,
  targetAddr: number,
  familyID: number = FAMILY_ID_RP2040,
  data?: Uint8Array
): Uint8Array {
  const block = new Uint8Array(512)
  const view = new DataView(block.buffer)

  // Header (32 bytes)
  view.setUint32(0, UF2_MAGIC_START0, true) // magic0
  view.setUint32(4, UF2_MAGIC_START1, true) // magic1
  view.setUint32(8, 0x00002000, true) // flags (family ID present)
  view.setUint32(12, targetAddr, true) // target address
  view.setUint32(16, 256, true) // payload size
  view.setUint32(20, blockNo, true) // block number
  view.setUint32(24, numBlocks, true) // number of blocks
  view.setUint32(28, familyID, true) // family ID

  // Data (476 bytes, only 256 used)
  if (data) {
    block.set(data.slice(0, 256), 32)
  } else {
    // Fill with test pattern
    for (let i = 0; i < 256; i++) {
      block[32 + i] = i % 256
    }
  }

  // Footer (4 bytes)
  view.setUint32(508, UF2_MAGIC_END, true)

  return block
}

// Create a complete UF2 file with multiple blocks
export function createValidUF2(
  numBlocks: number = 10,
  baseAddr: number = 0x10000000,
  familyID: number = FAMILY_ID_RP2040
): Uint8Array {
  const uf2 = new Uint8Array(512 * numBlocks)

  for (let i = 0; i < numBlocks; i++) {
    const block = createValidUF2Block(i, numBlocks, baseAddr + i * 256, familyID)
    uf2.set(block, i * 512)
  }

  return uf2
}

// Parse UF2 block
export function parseUF2Block(block: Uint8Array): UF2Block {
  const view = new DataView(block.buffer, block.byteOffset)

  return {
    magicStart0: view.getUint32(0, true),
    magicStart1: view.getUint32(4, true),
    flags: view.getUint32(8, true),
    targetAddr: view.getUint32(12, true),
    payloadSize: view.getUint32(16, true),
    blockNo: view.getUint32(20, true),
    numBlocks: view.getUint32(24, true),
    familyID: view.getUint32(28, true),
    data: block.slice(32, 32 + 476),
    magicEnd: view.getUint32(508, true),
  }
}
