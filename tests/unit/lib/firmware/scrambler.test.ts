import { describe, test, expect } from 'vitest';
import { scramble, validateDeterminism } from '@/lib/firmware/scrambler';

describe('Bootrom Scrambler - Core Algorithm', () => {
  describe('scramble', () => {
    test('returns same length as input', () => {
      const input = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const result = scramble(input);

      expect(result.byteLength).toBe(input.byteLength);
    });

    test('applies cryptographic transformation', () => {
      // Test that scrambling changes the data (not identity function)
      const input = new Uint8Array(256).fill(0xAA);
      const result = scramble(input);

      // Scrambled data should be different from input
      const inputHex = Array.from(input.slice(0, 16))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const resultHex = Array.from(result.slice(0, 16))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      expect(resultHex).not.toBe(inputHex);
    });

    test('produces deterministic output', () => {
      const input = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const result1 = scramble(input);
      const result2 = scramble(input);

      // Same input should produce same output
      expect(result1).toEqual(result2);
    });

    test('handles empty input', () => {
      const input = new Uint8Array(0);
      const result = scramble(input);

      expect(result.byteLength).toBe(0);
    });

    test('handles large input (1 MB)', () => {
      const input = new Uint8Array(1024 * 1024);
      const result = scramble(input);

      // Output should be same size as input
      expect(result.byteLength).toBe(input.byteLength);
    });

    test('scrambles all-zero input to non-zero output', () => {
      // Due to shift register initialization, even zeros get scrambled
      const input = new Uint8Array(16).fill(0x00);
      const result = scramble(input);

      // After scrambling zeros with prepend, we should get non-zero scrambled data
      const hasNonZero = Array.from(result).some(b => b !== 0);
      expect(hasNonZero).toBe(true);
    });

    test('scrambles sequential pattern correctly', () => {
      const input = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        input[i] = i & 0xFF;
      }

      const result = scramble(input);

      // Scrambled output should be different from sequential pattern
      expect(result).not.toEqual(input);
      expect(result.byteLength).toBe(256);
    });

    test('handles various input sizes', () => {
      const sizes = [1, 10, 100, 512, 1024, 4096, 10000];

      for (const size of sizes) {
        const input = new Uint8Array(size);
        const result = scramble(input);

        expect(result.byteLength).toBe(size);
      }
    });
  });

  describe('validateDeterminism', () => {
    test('confirms deterministic scrambling for small input', () => {
      const input = new Uint8Array([0x01, 0x02, 0x03]);
      expect(validateDeterminism(input)).toBe(true);
    });

    test('confirms deterministic scrambling for large input', () => {
      const input = new Uint8Array(1000);
      for (let i = 0; i < input.length; i++) {
        input[i] = i & 0xFF;
      }

      expect(validateDeterminism(input)).toBe(true);
    });

    test('confirms deterministic scrambling for empty input', () => {
      const input = new Uint8Array(0);
      expect(validateDeterminism(input)).toBe(true);
    });
  });

  describe('Shift register algorithm properties', () => {
    test('scrambling is self-inverse (applying twice returns original)', () => {
      // Interesting property: the algorithm is self-inverse when applied twice
      const input = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const scrambled = scramble(input);
      const doubleScrambled = scramble(scrambled);

      // Double scrambling returns original (algorithm is involutory)
      expect(doubleScrambled).toEqual(input);
    });

    test('different inputs produce different outputs', () => {
      const input1 = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const input2 = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);

      const result1 = scramble(input1);
      const result2 = scramble(input2);

      expect(result1).not.toEqual(result2);
    });

    test('single bit change produces different output', () => {
      const input1 = new Uint8Array(16).fill(0x00);
      const input2 = new Uint8Array(16).fill(0x00);
      input2[0] = 0x01; // Change single bit

      const result1 = scramble(input1);
      const result2 = scramble(input2);

      expect(result1).not.toEqual(result2);
    });
  });
});
