/**
 * Blob URL management for firmware downloads
 * Auto-revokes URLs after 5 minutes to prevent memory leaks
 */

interface BlobEntry {
  url: string
  revokeTimeout: number
}

// Track active blob URLs
const activeBlobURLs = new Map<string, BlobEntry>()

/**
 * Create a blob URL from binary data
 * @param data Binary firmware data
 * @param mimeType MIME type (default: application/octet-stream)
 * @param autoRevoke Auto-revoke after 5 minutes (default: true)
 * @returns Blob URL string
 */
export function createDownloadURL(
  data: Uint8Array,
  mimeType = 'application/octet-stream',
  autoRevoke = true
): string {
  const blob = new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)

  if (autoRevoke) {
    // Auto-revoke after 5 minutes (300000ms)
    const timeout = window.setTimeout(() => {
      revokeDownloadURL(url)
    }, 300000)

    activeBlobURLs.set(url, {
      url,
      revokeTimeout: timeout
    })
  }

  return url
}

/**
 * Manually revoke a blob URL
 * @param url Blob URL to revoke
 */
export function revokeDownloadURL(url: string): void {
  const entry = activeBlobURLs.get(url)

  if (entry) {
    clearTimeout(entry.revokeTimeout)
    activeBlobURLs.delete(url)
  }

  URL.revokeObjectURL(url)
}

/**
 * Revoke all active blob URLs
 * Call this on component unmount or app cleanup
 */
export function revokeAllDownloadURLs(): void {
  activeBlobURLs.forEach((entry) => {
    clearTimeout(entry.revokeTimeout)
    URL.revokeObjectURL(entry.url)
  })

  activeBlobURLs.clear()
}

/**
 * Get count of active blob URLs
 */
export function getActiveBlobCount(): number {
  return activeBlobURLs.size
}
