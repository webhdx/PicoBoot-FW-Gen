/**
 * GitHub API Rate Limit Tracking
 *
 * Tracks GitHub API rate limits to prevent exceeding quotas.
 * Unauthenticated API: 60 requests/hour
 *
 * Headers tracked:
 * - x-ratelimit-limit: Maximum requests per hour
 * - x-ratelimit-remaining: Remaining requests
 * - x-ratelimit-reset: Unix timestamp when limit resets
 */

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
}

export interface RateLimitStatus {
  isLimited: boolean;
  info: RateLimitInfo;
  resetIn: number; // milliseconds until reset
}

/**
 * Parses rate limit information from GitHub API response headers
 */
export function parseRateLimitHeaders(headers: Headers): RateLimitInfo | null {
  const limit = headers.get('x-ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');

  if (!limit || !remaining || !reset) {
    return null;
  }

  const limitNum = parseInt(limit, 10);
  const remainingNum = parseInt(remaining, 10);
  const resetNum = parseInt(reset, 10);

  return {
    limit: limitNum,
    remaining: remainingNum,
    reset: resetNum,
    used: limitNum - remainingNum,
  };
}

/**
 * Checks if rate limit is exceeded
 */
export function isRateLimited(info: RateLimitInfo): boolean {
  return info.remaining === 0;
}

/**
 * Calculates time until rate limit reset (in milliseconds)
 */
export function getResetTime(info: RateLimitInfo): number {
  const now = Math.floor(Date.now() / 1000);
  const resetIn = Math.max(0, info.reset - now);
  return resetIn * 1000; // Convert to milliseconds
}

/**
 * Gets human-readable time until reset
 */
export function getResetTimeFormatted(info: RateLimitInfo): string {
  const ms = getResetTime(info);
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Less than 60 seconds
  if (totalSeconds < 60) {
    return 'less than a minute';
  }

  // Exactly 1 minute (60-119 seconds)
  if (minutes === 1 && seconds < 60) {
    return '1 minute';
  }

  // Less than 1 hour
  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  // 1 hour or more
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
}

/**
 * Gets complete rate limit status
 */
export function getRateLimitStatus(info: RateLimitInfo): RateLimitStatus {
  return {
    isLimited: isRateLimited(info),
    info,
    resetIn: getResetTime(info),
  };
}

/**
 * Rate limit tracker singleton
 */
class RateLimitTracker {
  private currentInfo: RateLimitInfo | null = null;

  /**
   * Updates rate limit info from response headers
   */
  update(headers: Headers): void {
    const info = parseRateLimitHeaders(headers);
    if (info) {
      this.currentInfo = info;
    }
  }

  /**
   * Gets current rate limit info
   */
  getInfo(): RateLimitInfo | null {
    return this.currentInfo;
  }

  /**
   * Gets current rate limit status
   */
  getStatus(): RateLimitStatus | null {
    if (!this.currentInfo) {
      return null;
    }
    return getRateLimitStatus(this.currentInfo);
  }

  /**
   * Checks if currently rate limited
   */
  isLimited(): boolean {
    if (!this.currentInfo) {
      return false;
    }
    return isRateLimited(this.currentInfo);
  }

  /**
   * Resets tracker (for testing)
   */
  reset(): void {
    this.currentInfo = null;
  }
}

// Export singleton instance
export const rateLimitTracker = new RateLimitTracker();
