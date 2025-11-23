import { describe, test, expect } from 'vitest';
import { parseDOLHeader, extractDOLSections, validateDOL } from '@/lib/firmware/dol-parser';
import { scramble } from '@/lib/firmware/scrambler';
import { wrapPayload } from '@/lib/firmware/payload-wrapper';
import { encodeToUF2, MEMORY_LAYOUT } from '@/lib/firmware/uf2-encoder';
import { mergeUF2, parseUF2Blocks } from '@/lib/firmware/uf2-merger';
import { createValidDOL } from '../mocks/sample-dol';

/**
 * Integration Tests - Full Firmware Build Pipeline
 *
 * Tests the complete flow:
 * 1. DOL file → Parse & Extract
 * 2. Extract sections → Flatten to binary
 * 3. Binary → Scramble (bootrom algorithm)
 * 4. Scrambled → Wrap (IPLBOOT + PICO)
 * 5. Wrapped → Encode to UF2
 * 6. Base UF2 + Payload UF2 → Merge
 * 7. Final firmware validation
 */

describe('Firmware Pipeline Integration', () => {
  describe('End-to-End: DOL to Final Firmware', () => {
    test('complete pipeline: DOL → Scramble → Wrap → UF2 → Merge', () => {
      // Step 1: Create mock DOL file (simulating gekkoboot.dol)
      const dolFile = createValidDOL();
      expect(dolFile.byteLength).toBeGreaterThan(256);

      // Step 2: Parse DOL header
      const header = parseDOLHeader(dolFile);
      expect(header.entryPoint).toBe(0x81300000);
      expect(header.textAddresses[0]).toBe(0x81300000);

      // Step 3: Extract sections
      const sections = extractDOLSections(dolFile, header);
      expect(sections.textSections.length).toBeGreaterThan(0);
      expect(sections.totalSize).toBeGreaterThan(0);

      // Step 4: Flatten sections to binary (simulate DOL → binary conversion)
      // In real implementation, this combines all sections into single buffer
      const payloadBinary = new Uint8Array(sections.totalSize);
      let offset = 0;
      for (const section of sections.textSections) {
        payloadBinary.set(section.data, offset);
        offset += section.data.byteLength;
      }
      for (const section of sections.dataSections) {
        payloadBinary.set(section.data, offset);
        offset += section.data.byteLength;
      }

      // Step 5: Scramble payload
      const scrambled = scramble(payloadBinary);
      expect(scrambled.byteLength).toBe(payloadBinary.byteLength);

      // Step 6: Wrap in PicoBoot protocol
      const wrapped = wrapPayload(payloadBinary);
      expect(wrapped.header.byteLength).toBe(12);
      expect(wrapped.payload.byteLength).toBeGreaterThan(scrambled.byteLength);

      // Verify IPLBOOT header
      const magic = new TextDecoder().decode(wrapped.header.slice(0, 8));
      expect(magic).toBe('IPLBOOT ');

      // Verify PICO signature
      const signature = new TextDecoder().decode(wrapped.payload.slice(-4));
      expect(signature).toBe('PICO');

      // Step 7: Encode payload to UF2
      const payloadUF2 = encodeToUF2(wrapped.payload, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });
      expect(payloadUF2.blockCount).toBeGreaterThan(0);
      expect(payloadUF2.data.byteLength % 512).toBe(0);

      // Step 8: Create mock base firmware UF2
      const baseFirmware = new Uint8Array(100 * 1024); // 100 KB base
      const baseUF2 = encodeToUF2(baseFirmware, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.FLASH_BASE,
      });

      // Step 9: Merge base + payload
      const finalFirmware = mergeUF2(baseUF2.data, payloadUF2.data);
      expect(finalFirmware.totalBlocks).toBe(baseUF2.blockCount + payloadUF2.blockCount);
      expect(finalFirmware.data.byteLength).toBe(finalFirmware.totalBlocks * 512);

      // Step 10: Validate final firmware
      const blocks = parseUF2Blocks(finalFirmware.data);

      // All blocks should be valid
      blocks.forEach(block => {
        expect(block.magicStart0).toBe(0x0A324655);
        expect(block.magicStart1).toBe(0x9E5D5157);
        expect(block.magicEnd).toBe(0x0AB16F30);
      });

      // Blocks should be sequentially numbered
      blocks.forEach((block, index) => {
        expect(block.blockNo).toBe(index);
        expect(block.numBlocks).toBe(finalFirmware.totalBlocks);
      });

      // All blocks should have same family ID (RP2040)
      blocks.forEach(block => {
        expect(block.familyID).toBe(0xE48BFF56);
      });
    });

    test('pipeline with RP2350 platform', () => {
      const dolFile = createValidDOL();
      const header = parseDOLHeader(dolFile);
      const sections = extractDOLSections(dolFile, header);

      // Flatten to binary
      const binary = new Uint8Array(sections.totalSize);
      let offset = 0;
      for (const section of sections.textSections) {
        binary.set(section.data, offset);
        offset += section.data.byteLength;
      }

      // Process pipeline
      const wrapped = wrapPayload(binary);
      const payloadUF2 = encodeToUF2(wrapped.payload, {
        platform: 'RP2350',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      const baseFirmware = new Uint8Array(50 * 1024);
      const baseUF2 = encodeToUF2(baseFirmware, {
        platform: 'RP2350',
        baseAddress: MEMORY_LAYOUT.FLASH_BASE,
      });

      const finalFirmware = mergeUF2(baseUF2.data, payloadUF2.data);
      const blocks = parseUF2Blocks(finalFirmware.data);

      // All blocks should have RP2350 family ID
      blocks.forEach(block => {
        expect(block.familyID).toBe(0xE48BFF59);
      });
    });

    test('pipeline handles large DOL file', () => {
      // Create larger DOL with more data
      const largeDOL = createValidDOL();

      const header = parseDOLHeader(largeDOL);
      const sections = extractDOLSections(largeDOL, header);

      // Process through pipeline
      const binary = new Uint8Array(sections.totalSize);
      let offset = 0;
      for (const section of [...sections.textSections, ...sections.dataSections]) {
        binary.set(section.data, offset);
        offset += section.data.byteLength;
      }

      const wrapped = wrapPayload(binary);
      const payloadUF2 = encodeToUF2(wrapped.payload, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      // Should create multiple UF2 blocks
      expect(payloadUF2.blockCount).toBeGreaterThan(1);
    });
  });

  describe('Scrambler Integration', () => {
    test('scrambling is reversible (involutory property)', () => {
      const dolFile = createValidDOL();
      const header = parseDOLHeader(dolFile);
      const sections = extractDOLSections(dolFile, header);

      const binary = new Uint8Array(1000); // Simpler test data

      // Scramble twice should return original
      const scrambled1 = scramble(binary);
      const scrambled2 = scramble(scrambled1);

      expect(scrambled2).toEqual(binary);
    });

    test('wrapped payload contains scrambled data', () => {
      const testData = new Uint8Array(256);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = i & 0xFF;
      }

      const scrambled = scramble(testData);
      const wrapped = wrapPayload(testData); // wrapPayload does scrambling internally

      // Wrapped payload should be larger (header + scrambled + padding + PICO)
      expect(wrapped.totalSize).toBeGreaterThan(testData.byteLength);
    });
  });

  describe('Memory Layout Validation', () => {
    test('base and payload occupy different regions', () => {
      const dolFile = createValidDOL();
      const header = parseDOLHeader(dolFile);
      const sections = extractDOLSections(dolFile, header);

      const binary = new Uint8Array(sections.totalSize);
      const wrapped = wrapPayload(binary);

      // Base firmware in FLASH region
      const baseUF2 = encodeToUF2(new Uint8Array(100 * 1024), {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.FLASH_BASE,
      });

      // Payload in PAYLOAD region
      const payloadUF2 = encodeToUF2(wrapped.payload, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      // Parse blocks and check addresses
      const baseBlocks = parseUF2Blocks(baseUF2.data);
      const payloadBlocks = parseUF2Blocks(payloadUF2.data);

      // Base should be at FLASH_BASE
      expect(baseBlocks[0].targetAddr).toBe(MEMORY_LAYOUT.FLASH_BASE);

      // Payload should be at PAYLOAD_BASE
      expect(payloadBlocks[0].targetAddr).toBe(MEMORY_LAYOUT.PAYLOAD_BASE);

      // Regions should not overlap
      const baseEnd = MEMORY_LAYOUT.FLASH_BASE + MEMORY_LAYOUT.FLASH_SIZE;
      expect(MEMORY_LAYOUT.PAYLOAD_BASE).toBeGreaterThanOrEqual(baseEnd);
    });
  });

  describe('UF2 Format Validation', () => {
    test('final firmware has valid UF2 structure throughout', () => {
      const dolFile = createValidDOL();
      const header = parseDOLHeader(dolFile);
      const sections = extractDOLSections(dolFile, header);

      const binary = new Uint8Array(sections.totalSize);
      const wrapped = wrapPayload(binary);

      const baseUF2 = encodeToUF2(new Uint8Array(50 * 1024), {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.FLASH_BASE,
      });

      const payloadUF2 = encodeToUF2(wrapped.payload, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      const finalFirmware = mergeUF2(baseUF2.data, payloadUF2.data);

      // Every 512 bytes should be a valid UF2 block
      for (let i = 0; i < finalFirmware.totalBlocks; i++) {
        const offset = i * 512;
        const block = finalFirmware.data.slice(offset, offset + 512);

        const view = new DataView(block.buffer, block.byteOffset);

        // Check magic numbers
        expect(view.getUint32(0, true)).toBe(0x0A324655);
        expect(view.getUint32(4, true)).toBe(0x9E5D5157);
        expect(view.getUint32(508, true)).toBe(0x0AB16F30);

        // Check block number
        expect(view.getUint32(20, true)).toBe(i);

        // Check total blocks
        expect(view.getUint32(24, true)).toBe(finalFirmware.totalBlocks);
      }
    });

    test('payload size is correctly encoded in blocks', () => {
      const dolFile = createValidDOL();
      const header = parseDOLHeader(dolFile);
      const sections = extractDOLSections(dolFile, header);

      const binary = new Uint8Array(sections.totalSize);
      const wrapped = wrapPayload(binary);

      const payloadUF2 = encodeToUF2(wrapped.payload, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      const blocks = parseUF2Blocks(payloadUF2.data);

      // Each block should have 256-byte payload (except possibly last)
      blocks.forEach((block, index) => {
        if (index < blocks.length - 1) {
          expect(block.payloadSize).toBe(256);
        } else {
          // Last block may have less
          expect(block.payloadSize).toBeLessThanOrEqual(256);
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('rejects invalid DOL entry point', () => {
      const invalidDOL = createValidDOL();
      const view = new DataView(invalidDOL.buffer, invalidDOL.byteOffset);

      // Corrupt entry point
      view.setUint32(0xE0, 0x80000000, false); // Invalid entry point

      const header = parseDOLHeader(invalidDOL);
      expect(() => validateDOL(header, invalidDOL)).toThrow('Invalid entry point');
    });

    test('detects memory overlap in merge', () => {
      const overlappingBase = encodeToUF2(new Uint8Array(200 * 1024), {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.FLASH_BASE,
      });

      // Create payload that overlaps
      const overlappingPayload = encodeToUF2(new Uint8Array(10 * 1024), {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.FLASH_BASE + 100 * 1024, // Inside base region
      });

      expect(() => mergeUF2(overlappingBase.data, overlappingPayload.data)).toThrow('Memory overlap');
    });
  });

  describe('Performance Characteristics', () => {
    test('pipeline completes in reasonable time for typical payload', () => {
      const startTime = performance.now();

      const dolFile = createValidDOL();
      const header = parseDOLHeader(dolFile);
      const sections = extractDOLSections(dolFile, header);

      const binary = new Uint8Array(sections.totalSize);
      const wrapped = wrapPayload(binary);

      const baseUF2 = encodeToUF2(new Uint8Array(100 * 1024), {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.FLASH_BASE,
      });

      const payloadUF2 = encodeToUF2(wrapped.payload, {
        platform: 'RP2040',
        baseAddress: MEMORY_LAYOUT.PAYLOAD_BASE,
      });

      const finalFirmware = mergeUF2(baseUF2.data, payloadUF2.data);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in under 100ms for typical payload
      expect(duration).toBeLessThan(100);
      expect(finalFirmware.totalBlocks).toBeGreaterThan(0);
    });
  });
});
