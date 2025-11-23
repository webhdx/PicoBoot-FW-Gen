/**
 * Mock DOL file structure for testing
 * DOL format: 256-byte header + sections
 *
 * Based on real gekkoboot.dol header structure
 */

// Valid DOL header (256 bytes) - modeled after gekkoboot.dol
export function createValidDOLHeader(): Uint8Array {
  const header = new Uint8Array(256)
  const view = new DataView(header.buffer)

  // Text section offsets (7 sections, big-endian)
  // gekkoboot uses only 1 text section at offset 0x100
  view.setUint32(0x00, 0x00000100, false) // Text 0 offset
  // Text 1-6 are unused (0x00000000)

  // Data section offsets (11 sections, big-endian)
  // gekkoboot uses only 1 data section at offset 0x2680
  view.setUint32(0x1C, 0x00002680, false) // Data 0 offset
  // Data 1-10 are unused (0x00000000)

  // Text section addresses (7 sections)
  // CRITICAL: Text 0 address MUST be 0x81300000 for PicoBoot
  view.setUint32(0x48, 0x81300000, false) // Text 0 load address
  // Text 1-6 unused

  // Data section addresses (11 sections)
  // Data follows text in memory (0x81300000 + text_size)
  view.setUint32(0x64, 0x81302580, false) // Data 0 address
  // Data 1-10 unused

  // Text section sizes (7 sections)
  view.setUint32(0x90, 0x00002580, false) // Text 0 size (9600 bytes from gekkoboot)
  // Text 1-6 unused

  // Data section sizes (11 sections)
  view.setUint32(0xAC, 0x0000cb60, false) // Data 0 size (52064 bytes from gekkoboot)
  // Data 1-10 unused

  // BSS address and size
  view.setUint32(0xD8, 0x8130f0e0, false) // BSS address (after data)
  view.setUint32(0xDC, 0x00007820, false) // BSS size (30752 bytes)

  // Entry point (MUST be 0x81300000 for PicoBoot)
  view.setUint32(0xE0, 0x81300000, false)

  return header
}

// Create a complete valid DOL file (based on gekkoboot.dol structure)
export function createValidDOL(): Uint8Array {
  const header = createValidDOLHeader()

  // Text section: 0x2580 bytes (9600 bytes) - fill with NOP instructions
  // PowerPC NOP is 0x60000000 (ori r0, r0, 0)
  const textSection = new Uint8Array(0x2580)
  for (let i = 0; i < textSection.length; i += 4) {
    textSection[i] = 0x60
    textSection[i + 1] = 0x00
    textSection[i + 2] = 0x00
    textSection[i + 3] = 0x00
  }

  // Data section: 0xcb60 bytes (52064 bytes) - fill with test pattern
  const dataSection = new Uint8Array(0xcb60).fill(0xAA)

  // Total size: header(0x100) + text(0x2580) + data(0xcb60)
  const totalSize = 0x100 + 0x2580 + 0xcb60
  const dol = new Uint8Array(totalSize)

  // Layout matches offsets in header:
  // - Header at 0x00
  // - Text at 0x100 (matches text[0] offset)
  // - Data at 0x2680 (matches data[0] offset)
  dol.set(header, 0)
  dol.set(textSection, 0x100)
  dol.set(dataSection, 0x2680)

  return dol
}

// Create DOL with invalid entry point
export function createDOLWithInvalidEntryPoint(): Uint8Array {
  const header = createValidDOLHeader()
  const view = new DataView(header.buffer)
  view.setUint32(0xE0, 0x80000000, false) // Invalid entry point
  return header
}

// Create DOL with invalid load address
export function createDOLWithInvalidLoadAddress(): Uint8Array {
  const header = createValidDOLHeader()
  const view = new DataView(header.buffer)
  view.setUint32(0x48, 0x80000000, false) // Invalid load address
  return header
}
