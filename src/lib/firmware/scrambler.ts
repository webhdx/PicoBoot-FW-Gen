/**
 * Bootrom Scrambler - Core Cryptographic Algorithm
 *
 * Pure implementation of GameCube bootrom scrambling algorithm reversed by segher.
 * This module contains ONLY the cryptographic transformation using shift registers.
 *
 * The algorithm uses 3 shift registers (t, u, v) with polynomial feedback
 * to generate a pseudo-random bit stream that scrambles input data.
 *
 * Prepending 0x720 (1824) zero bytes before scrambling initializes the
 * shift registers to produce the correct scrambling sequence.
 *
 * Reference: https://github.com/webhdx/PicoBoot/blob/main/tools/process_ipl.py
 * Original reverse engineering by: segher
 */

const PREPEND_SIZE = 0x720; // 1824 bytes for register initialization

/**
 * Scrambles data using the bootrom descrambler algorithm
 *
 * This is the core cryptographic transformation. It:
 * 1. Prepends 0x720 zero bytes to initialize shift registers
 * 2. Applies XOR-based scrambling using 3 shift registers
 * 3. Strips the prepended bytes
 *
 * The output is pure scrambled data with NO headers or signatures.
 *
 * @param data - Raw data to scramble
 * @returns Scrambled data (same length as input)
 */
export function scramble(data: Uint8Array): Uint8Array {
  // Step 1: Prepend 0x720 zero bytes for register initialization
  const prepended = new Uint8Array(PREPEND_SIZE + data.byteLength);
  prepended.set(data, PREPEND_SIZE);

  // Step 2: Apply scrambling algorithm
  const scrambled = applyShiftRegisterScrambling(prepended);

  // Step 3: Strip prepended bytes and return
  return scrambled.slice(PREPEND_SIZE);
}

/**
 * Core shift register scrambling algorithm
 *
 * Uses 3 Linear Feedback Shift Registers (LFSRs):
 * - Register t: Initial 0x2953, feedback polynomial 0xA740
 * - Register u: Initial 0xD9C2, feedback polynomial 0xFB10
 * - Register v: Initial 0x3FF1, feedback polynomial 0xB3D0
 *
 * Processes data bit-by-bit, generating pseudo-random bits through
 * XOR operations and conditional register shifts.
 *
 * @param data - Data with prepended zeros
 * @returns Scrambled data
 */
function applyShiftRegisterScrambling(data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data);

  let acc = 0;    // Bit accumulator
  let nacc = 0;   // Accumulator bit count

  // Initialize Linear Feedback Shift Registers (LFSRs)
  let t = 0x2953;
  let u = 0xD9C2;
  let v = 0x3FF1;

  let x = 1;      // Output bit
  let it = 0;     // Data index

  while (it < result.length) {
    // Extract lowest bits from each register
    const t0 = t & 1;
    const t1 = (t >> 1) & 1;
    const u0 = u & 1;
    const u1 = (u >> 1) & 1;
    const v0 = v & 1;

    // Generate output bit through XOR operations
    x ^= t1 ^ v0;
    x ^= u0 | u1;
    x ^= (t0 ^ u1 ^ v0) & (t0 ^ u0);

    // Shift register v (conditional on t0 == u0)
    if (t0 === u0) {
      v >>= 1;
      if (v0) {
        v ^= 0xB3D0; // Polynomial feedback
      }
    }

    // Shift register u (conditional on t0 == 0)
    if (t0 === 0) {
      u >>= 1;
      if (u0) {
        u ^= 0xFB10; // Polynomial feedback
      }
    }

    // Shift register t (always)
    t >>= 1;
    if (t0) {
      t ^= 0xA740; // Polynomial feedback
    }

    // Accumulate 8 bits into a byte
    nacc = (nacc + 1) % 256;
    acc = (acc * 2 + x) % 256;

    if (nacc === 8) {
      result[it] ^= acc; // XOR accumulated byte with data
      nacc = 0;
      it += 1;
    }
  }

  return result;
}

/**
 * Validates that scrambling is deterministic
 *
 * @param data - Input data
 * @returns True if scrambling produces consistent output
 */
export function validateDeterminism(data: Uint8Array): boolean {
  const result1 = scramble(data);
  const result2 = scramble(data);

  if (result1.byteLength !== result2.byteLength) {
    return false;
  }

  for (let i = 0; i < result1.byteLength; i++) {
    if (result1[i] !== result2[i]) {
      return false;
    }
  }

  return true;
}
