import { describe, test, expect } from 'vitest'
import {
  createValidDOL,
  createValidDOLHeader,
  createDOLWithInvalidEntryPoint,
  createDOLWithInvalidLoadAddress,
} from '../mocks/sample-dol'
import {
  createValidUF2,
  createValidUF2Block,
  parseUF2Block,
  UF2_MAGIC_START0,
  UF2_MAGIC_START1,
  UF2_MAGIC_END,
  FAMILY_ID_RP2040,
  FAMILY_ID_RP2350,
} from '../mocks/sample-uf2'

describe('Mock DOL Files', () => {
  test('creates valid DOL header', () => {
    const header = createValidDOLHeader()
    expect(header).toBeInstanceOf(Uint8Array)
    expect(header.length).toBe(256)

    const view = new DataView(header.buffer)
    expect(view.getUint32(0xE0, false)).toBe(0x81300000) // Entry point
  })

  test('creates valid DOL file', () => {
    const dol = createValidDOL()
    expect(dol).toBeInstanceOf(Uint8Array)
    expect(dol.length).toBeGreaterThan(256)

    const view = new DataView(dol.buffer)
    expect(view.getUint32(0xE0, false)).toBe(0x81300000) // Valid entry point
    expect(view.getUint32(0x48, false)).toBe(0x81300000) // Valid load address
  })

  test('creates DOL with invalid entry point', () => {
    const dol = createDOLWithInvalidEntryPoint()
    const view = new DataView(dol.buffer)
    expect(view.getUint32(0xE0, false)).not.toBe(0x81300000)
  })

  test('creates DOL with invalid load address', () => {
    const dol = createDOLWithInvalidLoadAddress()
    const view = new DataView(dol.buffer)
    expect(view.getUint32(0x48, false)).not.toBe(0x81300000)
  })
})

describe('Mock UF2 Files', () => {
  test('creates valid UF2 block', () => {
    const block = createValidUF2Block(0, 1, 0x10000000)
    expect(block).toBeInstanceOf(Uint8Array)
    expect(block.length).toBe(512)

    const view = new DataView(block.buffer)
    expect(view.getUint32(0, true)).toBe(UF2_MAGIC_START0)
    expect(view.getUint32(4, true)).toBe(UF2_MAGIC_START1)
    expect(view.getUint32(508, true)).toBe(UF2_MAGIC_END)
  })

  test('creates UF2 block with RP2040 family ID', () => {
    const block = createValidUF2Block(0, 1, 0x10000000, FAMILY_ID_RP2040)
    const parsed = parseUF2Block(block)
    expect(parsed.familyID).toBe(FAMILY_ID_RP2040)
  })

  test('creates UF2 block with RP2350 family ID', () => {
    const block = createValidUF2Block(0, 1, 0x10000000, FAMILY_ID_RP2350)
    const parsed = parseUF2Block(block)
    expect(parsed.familyID).toBe(FAMILY_ID_RP2350)
  })

  test('creates valid UF2 file with multiple blocks', () => {
    const numBlocks = 10
    const uf2 = createValidUF2(numBlocks)
    expect(uf2).toBeInstanceOf(Uint8Array)
    expect(uf2.length).toBe(512 * numBlocks)

    // Verify first block
    const firstBlock = parseUF2Block(uf2.slice(0, 512))
    expect(firstBlock.magicStart0).toBe(UF2_MAGIC_START0)
    expect(firstBlock.blockNo).toBe(0)
    expect(firstBlock.numBlocks).toBe(numBlocks)

    // Verify last block
    const lastBlock = parseUF2Block(uf2.slice((numBlocks - 1) * 512, numBlocks * 512))
    expect(lastBlock.blockNo).toBe(numBlocks - 1)
    expect(lastBlock.numBlocks).toBe(numBlocks)
  })

  test('parses UF2 block correctly', () => {
    const block = createValidUF2Block(5, 10, 0x10001000, FAMILY_ID_RP2040)
    const parsed = parseUF2Block(block)

    expect(parsed.magicStart0).toBe(UF2_MAGIC_START0)
    expect(parsed.magicStart1).toBe(UF2_MAGIC_START1)
    expect(parsed.blockNo).toBe(5)
    expect(parsed.numBlocks).toBe(10)
    expect(parsed.targetAddr).toBe(0x10001000)
    expect(parsed.familyID).toBe(FAMILY_ID_RP2040)
    expect(parsed.payloadSize).toBe(256)
    expect(parsed.magicEnd).toBe(UF2_MAGIC_END)
  })
})
