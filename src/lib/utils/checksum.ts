/**
 * Calculate SHA256 checksum for binary data
 * Uses Web Crypto API (SubtleCrypto) - requires HTTPS
 */
export async function calculateSHA256(data: Uint8Array): Promise<string> {
  // Use SubtleCrypto API for SHA256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)

  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')

  return hashHex
}

/**
 * Calculate SHA256 for a file
 */
export async function calculateFileSHA256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  return calculateSHA256(uint8Array)
}
