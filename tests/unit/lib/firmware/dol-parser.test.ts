import { describe, test, expect } from 'vitest';
import { parseDOLHeader, validateDOL, extractDOLSections, type DOLHeader } from '@/lib/firmware/dol-parser';
import { createValidDOL } from '../../../mocks/sample-dol';

describe('DOL Parser', () => {
  describe('parseDOLHeader', () => {
    test('parses valid DOL header (256 bytes)', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // Header should contain all required fields
      expect(header.textOffsets).toHaveLength(7);
      expect(header.dataOffsets).toHaveLength(11);
      expect(header.textAddresses).toHaveLength(7);
      expect(header.dataAddresses).toHaveLength(11);
      expect(header.textSizes).toHaveLength(7);
      expect(header.dataSizes).toHaveLength(11);
      expect(header.bssAddress).toBeTypeOf('number');
      expect(header.bssSize).toBeTypeOf('number');
      expect(header.entryPoint).toBeTypeOf('number');
    });

    test('validates entry point 0x81300000', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      expect(header.entryPoint).toBe(0x81300000);
    });

    test('validates load address 0x01300000 (physical)', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // First text section should be at 0x81300000 (virtual)
      // Physical address is virtual - 0x80000000
      expect(header.textAddresses[0]).toBe(0x81300000);
    });

    test('extracts text sections (7 max)', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // Should have exactly 7 text section entries (some may be 0)
      expect(header.textOffsets).toHaveLength(7);
      expect(header.textAddresses).toHaveLength(7);
      expect(header.textSizes).toHaveLength(7);

      // First text section should have valid data (from gekkoboot)
      expect(header.textOffsets[0]).toBe(0x100);
      expect(header.textAddresses[0]).toBe(0x81300000);
      expect(header.textSizes[0]).toBe(0x2580); // 9,600 bytes
    });

    test('extracts data sections (11 max)', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // Should have exactly 11 data section entries (some may be 0)
      expect(header.dataOffsets).toHaveLength(11);
      expect(header.dataAddresses).toHaveLength(11);
      expect(header.dataSizes).toHaveLength(11);

      // First data section should have valid data (from gekkoboot)
      expect(header.dataOffsets[0]).toBe(0x2680);
      expect(header.dataAddresses[0]).toBe(0x81302580);
      expect(header.dataSizes[0]).toBe(0xcb60); // 52,064 bytes
    });

    test('calculates correct section offsets (big-endian)', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // Verify big-endian reading by checking known values
      // Text offset 0 should be at byte 0x00
      expect(header.textOffsets[0]).toBe(0x100);

      // Data offset 0 should be at byte 0x1C
      expect(header.dataOffsets[0]).toBe(0x2680);
    });

    test('parses BSS section correctly', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // BSS section from gekkoboot
      expect(header.bssAddress).toBe(0x8130f0e0);
      expect(header.bssSize).toBe(0x7820); // 30,752 bytes
    });

    test('rejects file smaller than 256 bytes', () => {
      const tooSmall = new Uint8Array(255);

      expect(() => parseDOLHeader(tooSmall)).toThrow('DOL file too small');
    });

    test('rejects file with all zero header', () => {
      const allZeros = new Uint8Array(256);

      expect(() => parseDOLHeader(allZeros)).toThrow('Invalid DOL header');
    });
  });

  describe('validateDOL', () => {
    test('validates correct entry point 0x81300000', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      expect(() => validateDOL(header, mockDOL)).not.toThrow();
    });

    test('rejects invalid entry point', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // Modify entry point
      header.entryPoint = 0x80000000;

      expect(() => validateDOL(header, mockDOL)).toThrow('Invalid entry point');
    });

    test('validates load address 0x81300000', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // First text address should be 0x81300000
      expect(header.textAddresses[0]).toBe(0x81300000);
      expect(() => validateDOL(header, mockDOL)).not.toThrow();
    });

    test('validates section offsets within file bounds', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // All sections should be within file size
      expect(() => validateDOL(header, mockDOL)).not.toThrow();
    });

    test('rejects section offset beyond file size', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // Create invalid offset
      header.textOffsets[0] = 999999;
      header.textSizes[0] = 1000;

      expect(() => validateDOL(header, mockDOL)).toThrow('Section offset out of bounds');
    });

    test('validates no overlapping sections', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // gekkoboot sections should not overlap
      expect(() => validateDOL(header, mockDOL)).not.toThrow();
    });

    test('rejects overlapping sections', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      // Create overlapping sections
      header.textOffsets[1] = 0x100; // Same as section 0
      header.textSizes[1] = 0x100;

      expect(() => validateDOL(header, mockDOL)).toThrow('Overlapping sections');
    });

    test('validates file size reasonable (< 5 MB)', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);

      expect(mockDOL.byteLength).toBeLessThan(5 * 1024 * 1024);
      expect(() => validateDOL(header, mockDOL)).not.toThrow();
    });

    test('rejects file larger than 5 MB', () => {
      const tooBig = new Uint8Array(6 * 1024 * 1024);
      // Set valid header
      const view = new DataView(tooBig.buffer);
      view.setUint32(0xE0, 0x81300000, false); // Entry point

      const header = parseDOLHeader(tooBig);

      expect(() => validateDOL(header, tooBig)).toThrow('DOL file too large');
    });
  });

  describe('extractDOLSections', () => {
    test('extracts text sections correctly', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);
      const sections = extractDOLSections(mockDOL, header);

      expect(sections.textSections).toHaveLength(1); // Only 1 non-empty section
      expect(sections.textSections[0].data.byteLength).toBe(0x2580);
    });

    test('extracts data sections correctly', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);
      const sections = extractDOLSections(mockDOL, header);

      expect(sections.dataSections).toHaveLength(1); // Only 1 non-empty section
      expect(sections.dataSections[0].data.byteLength).toBe(0xcb60);
    });

    test('skips empty sections (size = 0)', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);
      const sections = extractDOLSections(mockDOL, header);

      // gekkoboot has only 1 text and 1 data section populated
      expect(sections.textSections.length).toBe(1);
      expect(sections.dataSections.length).toBe(1);
    });

    test('includes section metadata', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);
      const sections = extractDOLSections(mockDOL, header);

      const textSection = sections.textSections[0];
      expect(textSection.offset).toBe(0x100);
      expect(textSection.address).toBe(0x81300000);
      expect(textSection.size).toBe(0x2580);
      expect(textSection.data).toBeInstanceOf(Uint8Array);
    });

    test('calculates total payload size', () => {
      const mockDOL = createValidDOL();
      const header = parseDOLHeader(mockDOL);
      const sections = extractDOLSections(mockDOL, header);

      // Total size = text + data sections
      const expectedSize = 0x2580 + 0xcb60;
      expect(sections.totalSize).toBe(expectedSize);
    });
  });
});
