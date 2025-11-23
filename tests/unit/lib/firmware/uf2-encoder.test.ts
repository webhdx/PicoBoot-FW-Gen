import { describe, test, expect } from 'vitest';
import {
  encodeToUF2,
  getFamilyId,
  validateUF2Block,
  validateUF2Data,
  extractFamilyId,
  countBlocks,
  UF2_FAMILY_IDS,
  MEMORY_LAYOUT,
  type Platform,
} from '@/lib/firmware/uf2-encoder';

describe('UF2 Encoder', () => {
  describe('encodeToUF2', () => {
    test('encodes data to UF2 format', () => {
      const data = new Uint8Array(256);
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      expect(result.data).toBeInstanceOf(Uint8Array);
      expect(result.blockCount).toBeGreaterThan(0);
      expect(result.totalSize).toBeGreaterThan(0);
    });

    test('creates 512-byte blocks', () => {
      const data = new Uint8Array(256);
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      // Total size should be multiple of 512
      expect(result.totalSize % 512).toBe(0);
    });

    test('sets correct family ID for RP2040', () => {
      const data = new Uint8Array(256);
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      expect(result.familyId).toBe(UF2_FAMILY_IDS.RP2040);

      // Check first block has correct family ID
      const firstBlock = result.data.slice(0, 512);
      expect(extractFamilyId(firstBlock)).toBe(UF2_FAMILY_IDS.RP2040);
    });

    test('sets correct family ID for RP2350', () => {
      const data = new Uint8Array(256);
      const result = encodeToUF2(data, {
        platform: 'RP2350',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      expect(result.familyId).toBe(UF2_FAMILY_IDS.RP2350);

      // Check first block has correct family ID
      const firstBlock = result.data.slice(0, 512);
      expect(extractFamilyId(firstBlock)).toBe(UF2_FAMILY_IDS.RP2350);
    });

    test('uses specified base address', () => {
      const data = new Uint8Array(256);
      const baseAddress = 0x10080000;

      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress,
      });

      expect(result.baseAddress).toBe(baseAddress);
    });

    test('calculates correct block count', () => {
      const data = new Uint8Array(512); // 2 blocks (256 bytes each)
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      expect(result.blockCount).toBe(2);
    });

    test('handles small data (< 256 bytes)', () => {
      const data = new Uint8Array(100);
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      expect(result.blockCount).toBe(1);
      expect(() => validateUF2Data(result.data)).not.toThrow();
    });

    test('handles large data (1 MB)', () => {
      const data = new Uint8Array(1024 * 1024);
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      // 1 MB = 4096 blocks (256 bytes per block)
      expect(result.blockCount).toBe(4096);
      expect(() => validateUF2Data(result.data)).not.toThrow();
    });

    test('produces valid UF2 data', () => {
      const data = new Uint8Array(256);
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      expect(() => validateUF2Data(result.data)).not.toThrow();
    });
  });

  describe('getFamilyId', () => {
    test('returns correct ID for RP2040', () => {
      expect(getFamilyId('RP2040')).toBe(0xE48BFF56);
    });

    test('returns correct ID for RP2350', () => {
      expect(getFamilyId('RP2350')).toBe(0xE48BFF59);
    });
  });

  describe('validateUF2Block', () => {
    test('validates correct UF2 block', () => {
      const data = new Uint8Array(256);
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      const firstBlock = result.data.slice(0, 512);
      expect(validateUF2Block(firstBlock)).toBe(true);
    });

    test('rejects block with wrong size', () => {
      const wrongSize = new Uint8Array(511);
      expect(validateUF2Block(wrongSize)).toBe(false);
    });

    test('rejects block with invalid magic numbers', () => {
      const data = new Uint8Array(256);
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      const corruptBlock = result.data.slice(0, 512);
      // Corrupt magic number
      corruptBlock[0] = 0xFF;

      expect(validateUF2Block(corruptBlock)).toBe(false);
    });
  });

  describe('validateUF2Data', () => {
    test('validates correct UF2 data', () => {
      const data = new Uint8Array(256);
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      expect(() => validateUF2Data(result.data)).not.toThrow();
    });

    test('rejects data with invalid size', () => {
      const invalidSize = new Uint8Array(513); // Not multiple of 512

      expect(() => validateUF2Data(invalidSize)).toThrow('must be multiple of 512');
    });

    test('rejects data with corrupted block', () => {
      const data = new Uint8Array(256);
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      // Corrupt first magic number of first block
      result.data[0] = 0xFF;

      expect(() => validateUF2Data(result.data)).toThrow('Invalid UF2 block');
    });
  });

  describe('extractFamilyId', () => {
    test('extracts family ID from RP2040 block', () => {
      const data = new Uint8Array(256);
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      const firstBlock = result.data.slice(0, 512);
      expect(extractFamilyId(firstBlock)).toBe(UF2_FAMILY_IDS.RP2040);
    });

    test('extracts family ID from RP2350 block', () => {
      const data = new Uint8Array(256);
      const result = encodeToUF2(data, {
        platform: 'RP2350',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      const firstBlock = result.data.slice(0, 512);
      expect(extractFamilyId(firstBlock)).toBe(UF2_FAMILY_IDS.RP2350);
    });

    test('rejects block too small', () => {
      const tooSmall = new Uint8Array(511);

      expect(() => extractFamilyId(tooSmall)).toThrow('Invalid UF2 block size');
    });
  });

  describe('countBlocks', () => {
    test('counts blocks correctly', () => {
      const data = new Uint8Array(512); // 2 blocks
      const result = encodeToUF2(data, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      expect(countBlocks(result.data)).toBe(2);
    });

    test('rejects invalid size', () => {
      const invalid = new Uint8Array(513);

      expect(() => countBlocks(invalid)).toThrow('not multiple of 512');
    });
  });

  describe('Constants', () => {
    test('UF2_FAMILY_IDS are correct', () => {
      expect(UF2_FAMILY_IDS.RP2040).toBe(0xE48BFF56);
      expect(UF2_FAMILY_IDS.RP2350).toBe(0xE48BFF59);
    });

    test('MEMORY_LAYOUT is correct', () => {
      expect(MEMORY_LAYOUT.FLASH_BASE).toBe(0x10000000);
      expect(MEMORY_LAYOUT.FLASH_SIZE).toBe(0x00080000);
      expect(MEMORY_LAYOUT.PAYLOAD_BASE).toBe(0x10080000);
      expect(MEMORY_LAYOUT.PAYLOAD_SIZE).toBe(0x00180000);
    });
  });

  describe('Integration tests', () => {
    test('encodes and validates RP2040 payload', () => {
      const payload = new Uint8Array(1024);
      for (let i = 0; i < payload.length; i++) {
        payload[i] = i & 0xFF;
      }

      const result = encodeToUF2(payload, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      // Should create 4 blocks (1024 / 256 = 4)
      expect(result.blockCount).toBe(4);
      expect(result.totalSize).toBe(4 * 512);
      expect(result.familyId).toBe(UF2_FAMILY_IDS.RP2040);

      // All blocks should be valid
      expect(() => validateUF2Data(result.data)).not.toThrow();

      // All blocks should have RP2040 family ID
      for (let i = 0; i < result.blockCount; i++) {
        const block = result.data.slice(i * 512, (i + 1) * 512);
        expect(extractFamilyId(block)).toBe(UF2_FAMILY_IDS.RP2040);
      }
    });

    test('encodes and validates RP2350 payload', () => {
      const payload = new Uint8Array(512);

      const result = encodeToUF2(payload, {
        platform: 'RP2350',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      expect(result.blockCount).toBe(2);
      expect(result.familyId).toBe(UF2_FAMILY_IDS.RP2350);

      // All blocks should have RP2350 family ID
      for (let i = 0; i < result.blockCount; i++) {
        const block = result.data.slice(i * 512, (i + 1) * 512);
        expect(extractFamilyId(block)).toBe(UF2_FAMILY_IDS.RP2350);
      }
    });
  });
});
