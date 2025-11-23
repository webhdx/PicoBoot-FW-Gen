import { describe, test, expect } from 'vitest';
import {
  mergeUF2,
  parseUF2Blocks,
  validateMemoryLayout,
  renumberBlocks,
  type UF2Block,
  type MergeResult,
} from '@/lib/firmware/uf2-merger';
import { encodeToUF2, MEMORY_LAYOUT } from '@/lib/firmware/uf2-encoder';

describe('UF2 Merger', () => {
  // Helper: Create test UF2 data
  function createTestUF2(size: number, baseAddress: number, platform: 'RP2040' | 'RP2350' = 'RP2040') {
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i & 0xFF;
    }
    return encodeToUF2(data, { platform, baseAddress });
  }

  describe('mergeUF2', () => {
    test('merges base and payload UF2 files', () => {
      const base = createTestUF2(512, MEMORY_LAYOUT.FLASH_BASE);
      const payload = createTestUF2(256, MEMORY_LAYOUT.PAYLOAD_BASE);

      const result = mergeUF2(base.data, payload.data);

      expect(result.data).toBeInstanceOf(Uint8Array);
      expect(result.totalBlocks).toBeGreaterThan(0);
      expect(result.baseBlocks).toBe(base.blockCount);
      expect(result.payloadBlocks).toBe(payload.blockCount);
    });

    test('combines all blocks from both files', () => {
      const base = createTestUF2(512, MEMORY_LAYOUT.FLASH_BASE);
      const payload = createTestUF2(256, MEMORY_LAYOUT.PAYLOAD_BASE);

      const result = mergeUF2(base.data, payload.data);

      expect(result.totalBlocks).toBe(base.blockCount + payload.blockCount);
    });

    test('renumbers block sequences correctly', () => {
      const base = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE);
      const payload = createTestUF2(256, MEMORY_LAYOUT.PAYLOAD_BASE);

      const result = mergeUF2(base.data, payload.data);
      const blocks = parseUF2Blocks(result.data);

      // Check block numbers are sequential
      blocks.forEach((block, index) => {
        expect(block.blockNo).toBe(index);
        expect(block.numBlocks).toBe(result.totalBlocks);
      });
    });

    test('preserves family ID from base firmware', () => {
      const base = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE, 'RP2040');
      const payload = createTestUF2(256, MEMORY_LAYOUT.PAYLOAD_BASE, 'RP2040');

      const result = mergeUF2(base.data, payload.data);
      const blocks = parseUF2Blocks(result.data);

      // All blocks should have same family ID as base
      blocks.forEach(block => {
        expect(block.familyID).toBe(0xE48BFF56); // RP2040
      });
    });

    test('handles different platforms (RP2350)', () => {
      const base = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE, 'RP2350');
      const payload = createTestUF2(256, MEMORY_LAYOUT.PAYLOAD_BASE, 'RP2350');

      const result = mergeUF2(base.data, payload.data);
      const blocks = parseUF2Blocks(result.data);

      blocks.forEach(block => {
        expect(block.familyID).toBe(0xE48BFF59); // RP2350
      });
    });

    test('maintains block order (base first, then payload)', () => {
      const base = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE);
      const payload = createTestUF2(256, MEMORY_LAYOUT.PAYLOAD_BASE);

      const result = mergeUF2(base.data, payload.data);
      const blocks = parseUF2Blocks(result.data);

      // First blocks should be from base (FLASH_BASE address)
      expect(blocks[0].targetAddr).toBe(MEMORY_LAYOUT.FLASH_BASE);

      // Last blocks should be from payload (PAYLOAD_BASE address)
      const lastBlock = blocks[blocks.length - 1];
      expect(lastBlock.targetAddr).toBeGreaterThanOrEqual(MEMORY_LAYOUT.PAYLOAD_BASE);
    });

    test('validates no memory overlap', () => {
      const base = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE);
      const payload = createTestUF2(256, MEMORY_LAYOUT.PAYLOAD_BASE);

      // Should not throw
      expect(() => mergeUF2(base.data, payload.data)).not.toThrow();
    });

    test('rejects overlapping memory regions', () => {
      const base = createTestUF2(10000, MEMORY_LAYOUT.FLASH_BASE); // Large base
      // Create payload that overlaps with base (starts inside base region)
      const payload = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE + 5000);

      expect(() => mergeUF2(base.data, payload.data)).toThrow('Memory overlap');
    });

    test('handles large files', () => {
      const base = createTestUF2(10000, MEMORY_LAYOUT.FLASH_BASE);
      const payload = createTestUF2(10000, MEMORY_LAYOUT.PAYLOAD_BASE);

      const result = mergeUF2(base.data, payload.data);

      expect(result.totalBlocks).toBeGreaterThan(50);
      expect(result.data.byteLength).toBe(result.totalBlocks * 512);
    });
  });

  describe('parseUF2Blocks', () => {
    test('parses UF2 blocks correctly', () => {
      const uf2 = createTestUF2(512, MEMORY_LAYOUT.FLASH_BASE);
      const blocks = parseUF2Blocks(uf2.data);

      expect(blocks.length).toBe(uf2.blockCount);
      blocks.forEach(block => {
        expect(block.magicStart0).toBe(0x0A324655);
        expect(block.magicStart1).toBe(0x9E5D5157);
        expect(block.magicEnd).toBe(0x0AB16F30);
      });
    });

    test('extracts all block fields', () => {
      const uf2 = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE);
      const blocks = parseUF2Blocks(uf2.data);

      const block = blocks[0];
      expect(block.flags).toBeDefined();
      expect(block.targetAddr).toBeDefined();
      expect(block.payloadSize).toBeDefined();
      expect(block.blockNo).toBeDefined();
      expect(block.numBlocks).toBeDefined();
      expect(block.familyID).toBeDefined();
      expect(block.data).toBeInstanceOf(Uint8Array);
      expect(block.data.byteLength).toBe(256);
    });

    test('rejects invalid UF2 data', () => {
      const invalid = new Uint8Array(513); // Not multiple of 512

      expect(() => parseUF2Blocks(invalid)).toThrow('Invalid UF2 data size');
    });

    test('rejects corrupted blocks', () => {
      const uf2 = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE);
      // Corrupt magic number
      uf2.data[0] = 0xFF;

      expect(() => parseUF2Blocks(uf2.data)).toThrow('Invalid UF2 block');
    });
  });

  describe('validateMemoryLayout', () => {
    test('validates non-overlapping regions', () => {
      const base = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE);
      const payload = createTestUF2(256, MEMORY_LAYOUT.PAYLOAD_BASE);

      const baseBlocks = parseUF2Blocks(base.data);
      const payloadBlocks = parseUF2Blocks(payload.data);

      expect(() => validateMemoryLayout(baseBlocks, payloadBlocks)).not.toThrow();
    });

    test('detects overlapping regions', () => {
      const base = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE);
      const payload = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE + 100); // Overlap!

      const baseBlocks = parseUF2Blocks(base.data);
      const payloadBlocks = parseUF2Blocks(payload.data);

      expect(() => validateMemoryLayout(baseBlocks, payloadBlocks)).toThrow('Memory overlap');
    });

    test('validates base is in flash region', () => {
      const base = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE);
      const payload = createTestUF2(256, MEMORY_LAYOUT.PAYLOAD_BASE);

      const baseBlocks = parseUF2Blocks(base.data);
      const payloadBlocks = parseUF2Blocks(payload.data);

      // Base should start at FLASH_BASE
      expect(baseBlocks[0].targetAddr).toBe(MEMORY_LAYOUT.FLASH_BASE);

      expect(() => validateMemoryLayout(baseBlocks, payloadBlocks)).not.toThrow();
    });

    test('validates payload is in payload region', () => {
      const base = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE);
      const payload = createTestUF2(256, MEMORY_LAYOUT.PAYLOAD_BASE);

      const baseBlocks = parseUF2Blocks(base.data);
      const payloadBlocks = parseUF2Blocks(payload.data);

      // Payload should start at or after PAYLOAD_BASE
      expect(payloadBlocks[0].targetAddr).toBeGreaterThanOrEqual(MEMORY_LAYOUT.PAYLOAD_BASE);

      expect(() => validateMemoryLayout(baseBlocks, payloadBlocks)).not.toThrow();
    });
  });

  describe('renumberBlocks', () => {
    test('renumbers blocks sequentially', () => {
      const uf2 = createTestUF2(512, MEMORY_LAYOUT.FLASH_BASE);
      const blocks = parseUF2Blocks(uf2.data);

      const renumbered = renumberBlocks(blocks);

      renumbered.forEach((block, index) => {
        expect(block.blockNo).toBe(index);
        expect(block.numBlocks).toBe(renumbered.length);
      });
    });

    test('preserves block data', () => {
      const uf2 = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE);
      const blocks = parseUF2Blocks(uf2.data);

      const original = blocks[0];
      const renumbered = renumberBlocks(blocks);
      const updated = renumbered[0];

      // Data should be unchanged
      expect(updated.data).toEqual(original.data);
      expect(updated.targetAddr).toBe(original.targetAddr);
      expect(updated.familyID).toBe(original.familyID);
      expect(updated.payloadSize).toBe(original.payloadSize);
    });

    test('handles empty array', () => {
      const renumbered = renumberBlocks([]);
      expect(renumbered).toEqual([]);
    });

    test('handles single block', () => {
      const uf2 = createTestUF2(256, MEMORY_LAYOUT.FLASH_BASE);
      const blocks = parseUF2Blocks(uf2.data);

      const renumbered = renumberBlocks(blocks);

      expect(renumbered.length).toBe(1);
      expect(renumbered[0].blockNo).toBe(0);
      expect(renumbered[0].numBlocks).toBe(1);
    });
  });

  describe('Integration tests', () => {
    test('full merge workflow', () => {
      // Create realistic base firmware (512 KB)
      const base = createTestUF2(512 * 1024, MEMORY_LAYOUT.FLASH_BASE, 'RP2040');

      // Create payload (wrapped scrambled DOL)
      const payload = createTestUF2(100 * 1024, MEMORY_LAYOUT.PAYLOAD_BASE, 'RP2040');

      // Merge
      const result = mergeUF2(base.data, payload.data);

      // Validate result
      expect(result.totalBlocks).toBe(base.blockCount + payload.blockCount);
      expect(result.data.byteLength).toBe(result.totalBlocks * 512);

      // Parse and validate blocks
      const blocks = parseUF2Blocks(result.data);
      expect(blocks.length).toBe(result.totalBlocks);

      // Check sequential numbering
      blocks.forEach((block, index) => {
        expect(block.blockNo).toBe(index);
        expect(block.numBlocks).toBe(result.totalBlocks);
      });

      // Check family ID consistency (all RP2040)
      blocks.forEach(block => {
        expect(block.familyID).toBe(0xE48BFF56);
      });
    });

    test('merge with RP2350 platform', () => {
      const base = createTestUF2(10000, MEMORY_LAYOUT.FLASH_BASE, 'RP2350');
      const payload = createTestUF2(5000, MEMORY_LAYOUT.PAYLOAD_BASE, 'RP2350');

      const result = mergeUF2(base.data, payload.data);
      const blocks = parseUF2Blocks(result.data);

      // All blocks should have RP2350 family ID
      blocks.forEach(block => {
        expect(block.familyID).toBe(0xE48BFF59);
      });
    });
  });
});
