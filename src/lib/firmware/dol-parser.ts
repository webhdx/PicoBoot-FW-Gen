/**
 * DOL (Dolphin Executable) Parser
 *
 * Parses GameCube/Wii DOL executable format.
 * Format: 256-byte header + text sections + data sections
 *
 * Header structure (all big-endian):
 * - 0x00-0x1B: Text section offsets (7 x 4 bytes)
 * - 0x1C-0x47: Data section offsets (11 x 4 bytes)
 * - 0x48-0x63: Text section addresses (7 x 4 bytes)
 * - 0x64-0x8F: Data section addresses (11 x 4 bytes)
 * - 0x90-0xAB: Text section sizes (7 x 4 bytes)
 * - 0xAC-0xD7: Data section sizes (11 x 4 bytes)
 * - 0xD8-0xDB: BSS address (4 bytes)
 * - 0xDC-0xDF: BSS size (4 bytes)
 * - 0xE0-0xE3: Entry point (4 bytes) - must be 0x81300000
 * - 0xE4-0xFF: Padding/unused
 *
 * Reference: https://wiki.tockdom.com/wiki/DOL_(File_Format)
 */

export interface DOLHeader {
  textOffsets: number[];      // 7 offsets
  dataOffsets: number[];      // 11 offsets
  textAddresses: number[];    // 7 addresses
  dataAddresses: number[];    // 11 addresses
  textSizes: number[];        // 7 sizes
  dataSizes: number[];        // 11 sizes
  bssAddress: number;
  bssSize: number;
  entryPoint: number;         // Must be 0x81300000
}

export interface DOLSection {
  offset: number;   // File offset
  address: number;  // Memory address
  size: number;     // Section size
  data: Uint8Array; // Section data
}

export interface DOLSections {
  textSections: DOLSection[];
  dataSections: DOLSection[];
  totalSize: number;
}

const DOL_HEADER_SIZE = 256;
const DOL_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const EXPECTED_ENTRY_POINT = 0x81300000;
const TEXT_SECTION_COUNT = 7;
const DATA_SECTION_COUNT = 11;

/**
 * Parses DOL header (256 bytes)
 */
export function parseDOLHeader(data: Uint8Array): DOLHeader {
  if (data.byteLength < DOL_HEADER_SIZE) {
    throw new Error(`DOL file too small: ${data.byteLength} bytes (expected at least ${DOL_HEADER_SIZE})`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Read arrays
  const textOffsets = readU32Array(view, 0x00, TEXT_SECTION_COUNT);
  const dataOffsets = readU32Array(view, 0x1C, DATA_SECTION_COUNT);
  const textAddresses = readU32Array(view, 0x48, TEXT_SECTION_COUNT);
  const dataAddresses = readU32Array(view, 0x64, DATA_SECTION_COUNT);
  const textSizes = readU32Array(view, 0x90, TEXT_SECTION_COUNT);
  const dataSizes = readU32Array(view, 0xAC, DATA_SECTION_COUNT);

  // Read single values
  const bssAddress = view.getUint32(0xD8, false); // big-endian
  const bssSize = view.getUint32(0xDC, false);
  const entryPoint = view.getUint32(0xE0, false);

  // Validate header is not all zeros
  const isAllZeros = textOffsets.every(v => v === 0) &&
                     dataOffsets.every(v => v === 0) &&
                     textAddresses.every(v => v === 0) &&
                     entryPoint === 0;

  if (isAllZeros) {
    throw new Error('Invalid DOL header: all zeros');
  }

  return {
    textOffsets,
    dataOffsets,
    textAddresses,
    dataAddresses,
    textSizes,
    dataSizes,
    bssAddress,
    bssSize,
    entryPoint,
  };
}

/**
 * Validates DOL header and file structure
 */
export function validateDOL(header: DOLHeader, data: Uint8Array): void {
  // Check file size
  if (data.byteLength > DOL_MAX_SIZE) {
    throw new Error(`DOL file too large: ${data.byteLength} bytes (max ${DOL_MAX_SIZE})`);
  }

  // Validate entry point
  if (header.entryPoint !== EXPECTED_ENTRY_POINT) {
    throw new Error(
      `Invalid entry point: 0x${header.entryPoint.toString(16).toUpperCase()} ` +
      `(expected 0x${EXPECTED_ENTRY_POINT.toString(16).toUpperCase()})`
    );
  }

  // Validate first text section load address
  if (header.textAddresses[0] !== EXPECTED_ENTRY_POINT) {
    throw new Error(
      `Invalid load address: 0x${header.textAddresses[0].toString(16).toUpperCase()} ` +
      `(expected 0x${EXPECTED_ENTRY_POINT.toString(16).toUpperCase()})`
    );
  }

  // Validate text sections
  for (let i = 0; i < TEXT_SECTION_COUNT; i++) {
    if (header.textSizes[i] > 0) {
      validateSection(
        header.textOffsets[i],
        header.textSizes[i],
        data.byteLength,
        `Text section ${i}`
      );
    }
  }

  // Validate data sections
  for (let i = 0; i < DATA_SECTION_COUNT; i++) {
    if (header.dataSizes[i] > 0) {
      validateSection(
        header.dataOffsets[i],
        header.dataSizes[i],
        data.byteLength,
        `Data section ${i}`
      );
    }
  }

  // Check for overlapping sections in file
  checkOverlappingSections(header);
}

/**
 * Extracts all non-empty sections from DOL file
 */
export function extractDOLSections(data: Uint8Array, header: DOLHeader): DOLSections {
  const textSections: DOLSection[] = [];
  const dataSections: DOLSection[] = [];
  let totalSize = 0;

  // Extract text sections
  for (let i = 0; i < TEXT_SECTION_COUNT; i++) {
    if (header.textSizes[i] > 0) {
      const offset = header.textOffsets[i];
      const size = header.textSizes[i];
      const sectionData = data.slice(offset, offset + size);

      textSections.push({
        offset,
        address: header.textAddresses[i],
        size,
        data: sectionData,
      });

      totalSize += size;
    }
  }

  // Extract data sections
  for (let i = 0; i < DATA_SECTION_COUNT; i++) {
    if (header.dataSizes[i] > 0) {
      const offset = header.dataOffsets[i];
      const size = header.dataSizes[i];
      const sectionData = data.slice(offset, offset + size);

      dataSections.push({
        offset,
        address: header.dataAddresses[i],
        size,
        data: sectionData,
      });

      totalSize += size;
    }
  }

  return {
    textSections,
    dataSections,
    totalSize,
  };
}

/**
 * Helper: Read array of uint32 values (big-endian)
 */
function readU32Array(view: DataView, offset: number, count: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(view.getUint32(offset + i * 4, false)); // false = big-endian
  }
  return result;
}

/**
 * Helper: Validate section bounds
 */
function validateSection(offset: number, size: number, fileSize: number, name: string): void {
  if (offset + size > fileSize) {
    throw new Error(
      `Section offset out of bounds: ${name} at 0x${offset.toString(16)} ` +
      `size 0x${size.toString(16)} exceeds file size 0x${fileSize.toString(16)}`
    );
  }
}

/**
 * Helper: Check for overlapping sections in file
 */
function checkOverlappingSections(header: DOLHeader): void {
  const sections: { offset: number; size: number; name: string }[] = [];

  // Collect all non-empty sections
  for (let i = 0; i < TEXT_SECTION_COUNT; i++) {
    if (header.textSizes[i] > 0) {
      sections.push({
        offset: header.textOffsets[i],
        size: header.textSizes[i],
        name: `Text ${i}`,
      });
    }
  }

  for (let i = 0; i < DATA_SECTION_COUNT; i++) {
    if (header.dataSizes[i] > 0) {
      sections.push({
        offset: header.dataOffsets[i],
        size: header.dataSizes[i],
        name: `Data ${i}`,
      });
    }
  }

  // Sort by offset
  sections.sort((a, b) => a.offset - b.offset);

  // Check for overlaps
  for (let i = 0; i < sections.length - 1; i++) {
    const current = sections[i];
    const next = sections[i + 1];
    const currentEnd = current.offset + current.size;

    if (currentEnd > next.offset) {
      throw new Error(
        `Overlapping sections: ${current.name} (0x${current.offset.toString(16)}-0x${currentEnd.toString(16)}) ` +
        `overlaps ${next.name} (0x${next.offset.toString(16)})`
      );
    }
  }
}
