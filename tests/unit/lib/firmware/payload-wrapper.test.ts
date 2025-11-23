import { describe, test, expect } from 'vitest';
import {
  wrapPayload,
  createIPLBOOTHeader,
  validateWrappedPayload,
  extractPayloadSize,
  type WrappedPayload,
} from '@/lib/firmware/payload-wrapper';

describe('Payload Wrapper - PicoBoot Protocol', () => {
  describe('wrapPayload', () => {
    test('wraps payload with header and PICO signature', () => {
      const input = new Uint8Array(100);
      const result = wrapPayload(input);

      // Should have header
      expect(result.header).toBeInstanceOf(Uint8Array);
      expect(result.header.byteLength).toBe(12);

      // Should have payload with PICO signature
      expect(result.payload).toBeInstanceOf(Uint8Array);

      // Should have total size
      expect(result.totalSize).toBe(result.header.byteLength + result.payload.byteLength);
    });

    test('adds 4-byte alignment padding', () => {
      // Test with size that needs padding (101 bytes)
      const input = new Uint8Array(101);
      const result = wrapPayload(input);

      // Scrambled 101 bytes + align to 4 = 104 bytes + PICO (4) = 108 bytes
      expect(result.payload.byteLength).toBe(108);
    });

    test('handles already-aligned input', () => {
      // Test with size already aligned (100 bytes)
      const input = new Uint8Array(100);
      const result = wrapPayload(input);

      // Scrambled 100 bytes + align to 4 = 100 bytes + PICO (4) = 104 bytes
      expect(result.payload.byteLength).toBe(104);
    });

    test('adds PICO signature at end', () => {
      const input = new Uint8Array(100);
      const result = wrapPayload(input);

      // Check last 4 bytes are "PICO"
      const signature = result.payload.slice(-4);
      const sigStr = new TextDecoder().decode(signature);
      expect(sigStr).toBe('PICO');
    });

    test('header contains IPLBOOT magic', () => {
      const input = new Uint8Array(100);
      const result = wrapPayload(input);

      const magic = new TextDecoder().decode(result.header.slice(0, 8));
      expect(magic).toBe('IPLBOOT ');
    });

    test('handles empty input', () => {
      const input = new Uint8Array(0);
      const result = wrapPayload(input);

      // Empty scrambled (0) + align to 4 (0) + PICO (4) = 4 bytes
      expect(result.payload.byteLength).toBe(4);
      expect(result.header.byteLength).toBe(12);
    });

    test('handles large input (1 MB)', () => {
      const input = new Uint8Array(1024 * 1024);
      const result = wrapPayload(input);

      // 1 MB scrambled + align (already aligned) + PICO (4) = 1048580 bytes
      expect(result.payload.byteLength).toBe(1024 * 1024 + 4);
    });

    test('wrapping is deterministic', () => {
      const input = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const result1 = wrapPayload(input);
      const result2 = wrapPayload(input);

      expect(result1.header).toEqual(result2.header);
      expect(result1.payload).toEqual(result2.payload);
      expect(result1.totalSize).toBe(result2.totalSize);
    });
  });

  describe('createIPLBOOTHeader', () => {
    test('generates IPLBOOT magic (8 bytes)', () => {
      const header = createIPLBOOTHeader(1000);

      const magic = new TextDecoder().decode(header.slice(0, 8));
      expect(magic).toBe('IPLBOOT ');
    });

    test('includes size in big-endian (4 bytes)', () => {
      const size = 0x12345678;
      const header = createIPLBOOTHeader(size);

      // Read size at offset 8 (big-endian)
      const view = new DataView(header.buffer, header.byteOffset);
      const readSize = view.getUint32(8, false); // false = big-endian

      expect(readSize).toBe(size);
    });

    test('header is exactly 12 bytes', () => {
      const header = createIPLBOOTHeader(1000);
      expect(header.byteLength).toBe(12);
    });

    test('handles size = 0', () => {
      const header = createIPLBOOTHeader(0);
      const view = new DataView(header.buffer, header.byteOffset);
      const readSize = view.getUint32(8, false);

      expect(readSize).toBe(0);
    });

    test('handles max uint32 size', () => {
      const maxSize = 0xFFFFFFFF;
      const header = createIPLBOOTHeader(maxSize);
      const view = new DataView(header.buffer, header.byteOffset);
      const readSize = view.getUint32(8, false);

      expect(readSize).toBe(maxSize);
    });
  });

  describe('validateWrappedPayload', () => {
    test('validates correct wrapped payload', () => {
      const input = new Uint8Array(100);
      const result = wrapPayload(input);

      expect(() => validateWrappedPayload(result)).not.toThrow();
    });

    test('rejects invalid IPLBOOT header magic', () => {
      const input = new Uint8Array(100);
      const result = wrapPayload(input);

      // Corrupt header
      result.header[0] = 0xFF;

      expect(() => validateWrappedPayload(result)).toThrow('Invalid IPLBOOT header magic');
    });

    test('rejects invalid header size', () => {
      const wrongHeader = new Uint8Array(10); // Wrong size
      // Add valid magic to pass first check
      wrongHeader.set([0x49, 0x50, 0x4C, 0x42, 0x4F, 0x4F, 0x54, 0x20], 0); // "IPLBOOT "

      const payload: WrappedPayload = {
        header: wrongHeader,
        payload: new Uint8Array(100),
        totalSize: 110,
      };

      expect(() => validateWrappedPayload(payload)).toThrow('Invalid header size');
    });

    test('rejects invalid PICO signature', () => {
      const input = new Uint8Array(100);
      const result = wrapPayload(input);

      // Corrupt PICO signature
      result.payload[result.payload.byteLength - 1] = 0xFF;

      expect(() => validateWrappedPayload(result)).toThrow('Invalid PICO signature');
    });

    test('rejects total size mismatch', () => {
      const input = new Uint8Array(100);
      const result = wrapPayload(input);

      // Corrupt total size
      result.totalSize = 999;

      expect(() => validateWrappedPayload(result)).toThrow('Total size mismatch');
    });
  });

  describe('extractPayloadSize', () => {
    test('extracts size from valid header', () => {
      const size = 12345;
      const header = createIPLBOOTHeader(size);

      const extracted = extractPayloadSize(header);
      expect(extracted).toBe(size);
    });

    test('handles various sizes', () => {
      const sizes = [0, 100, 1000, 0x12345678, 0xFFFFFFFF];

      for (const size of sizes) {
        const header = createIPLBOOTHeader(size);
        const extracted = extractPayloadSize(header);
        expect(extracted).toBe(size);
      }
    });

    test('rejects header too small', () => {
      const tooSmall = new Uint8Array(11);

      expect(() => extractPayloadSize(tooSmall)).toThrow('Header too small');
    });

    test('works with header larger than 12 bytes', () => {
      // Create 32-byte header (like original Python)
      const largeHeader = new Uint8Array(32);
      largeHeader.set(createIPLBOOTHeader(5678), 0);

      const extracted = extractPayloadSize(largeHeader);
      expect(extracted).toBe(5678);
    });
  });

  describe('Integration tests', () => {
    test('wraps 256-byte payload correctly', () => {
      const payload = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        payload[i] = i & 0xFF;
      }

      const result = wrapPayload(payload);

      // Verify structure
      expect(result.header.byteLength).toBe(12);
      // 256 scrambled + align (already 4-aligned) + PICO (4) = 260
      expect(result.payload.byteLength).toBe(260);

      // Verify it passes validation
      expect(() => validateWrappedPayload(result)).not.toThrow();

      // Verify header magic
      const magic = new TextDecoder().decode(result.header.slice(0, 8));
      expect(magic).toBe('IPLBOOT ');

      // Verify PICO signature
      const sig = new TextDecoder().decode(result.payload.slice(-4));
      expect(sig).toBe('PICO');
    });

    test('round-trip: wrap and extract size', () => {
      const input = new Uint8Array(100);
      const wrapped = wrapPayload(input);

      const extractedSize = extractPayloadSize(wrapped.header);

      // Size should be payload length + 32 (full header size)
      expect(extractedSize).toBe(wrapped.payload.byteLength + 32);
    });
  });
});
