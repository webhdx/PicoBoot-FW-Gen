import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseRateLimitHeaders,
  isRateLimited,
  getResetTime,
  getResetTimeFormatted,
  getRateLimitStatus,
  rateLimitTracker,
  type RateLimitInfo,
} from '../../../../src/lib/github/rate-limit';

describe('parseRateLimitHeaders', () => {
  it('should parse valid rate limit headers', () => {
    const headers = new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '45',
      'x-ratelimit-reset': '1700000000',
    });

    const info = parseRateLimitHeaders(headers);

    expect(info).toEqual({
      limit: 60,
      remaining: 45,
      reset: 1700000000,
      used: 15,
    });
  });

  it('should return null if headers are missing', () => {
    const headers = new Headers();
    const info = parseRateLimitHeaders(headers);
    expect(info).toBeNull();
  });

  it('should return null if only some headers are present', () => {
    const headers = new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '45',
    });

    const info = parseRateLimitHeaders(headers);
    expect(info).toBeNull();
  });

  it('should parse headers with remaining = 0', () => {
    const headers = new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1700000000',
    });

    const info = parseRateLimitHeaders(headers);

    expect(info).toEqual({
      limit: 60,
      remaining: 0,
      reset: 1700000000,
      used: 60,
    });
  });

  it('should calculate used correctly', () => {
    const headers = new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '10',
      'x-ratelimit-reset': '1700000000',
    });

    const info = parseRateLimitHeaders(headers);
    expect(info?.used).toBe(50);
  });
});

describe('isRateLimited', () => {
  it('should return true when remaining is 0', () => {
    const info: RateLimitInfo = {
      limit: 60,
      remaining: 0,
      reset: 1700000000,
      used: 60,
    };

    expect(isRateLimited(info)).toBe(true);
  });

  it('should return false when remaining > 0', () => {
    const info: RateLimitInfo = {
      limit: 60,
      remaining: 45,
      reset: 1700000000,
      used: 15,
    };

    expect(isRateLimited(info)).toBe(false);
  });

  it('should return false when remaining = 1', () => {
    const info: RateLimitInfo = {
      limit: 60,
      remaining: 1,
      reset: 1700000000,
      used: 59,
    };

    expect(isRateLimited(info)).toBe(false);
  });
});

describe('getResetTime', () => {
  it('should calculate time until reset in milliseconds', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetIn60Seconds = now + 60;

    const info: RateLimitInfo = {
      limit: 60,
      remaining: 0,
      reset: resetIn60Seconds,
      used: 60,
    };

    const resetTime = getResetTime(info);
    expect(resetTime).toBeGreaterThanOrEqual(59000);
    expect(resetTime).toBeLessThanOrEqual(61000);
  });

  it('should return 0 if reset time is in the past', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetInPast = now - 60;

    const info: RateLimitInfo = {
      limit: 60,
      remaining: 0,
      reset: resetInPast,
      used: 60,
    };

    const resetTime = getResetTime(info);
    expect(resetTime).toBe(0);
  });

  it('should return 0 if reset time is now', () => {
    const now = Math.floor(Date.now() / 1000);

    const info: RateLimitInfo = {
      limit: 60,
      remaining: 0,
      reset: now,
      used: 60,
    };

    const resetTime = getResetTime(info);
    expect(resetTime).toBeLessThanOrEqual(1000); // Allow for small timing variance
  });
});

describe('getResetTimeFormatted', () => {
  it('should format less than 1 minute', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetIn30Seconds = now + 30;

    const info: RateLimitInfo = {
      limit: 60,
      remaining: 0,
      reset: resetIn30Seconds,
      used: 60,
    };

    expect(getResetTimeFormatted(info)).toBe('less than a minute');
  });

  it('should format 1 minute', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetIn90Seconds = now + 90;

    const info: RateLimitInfo = {
      limit: 60,
      remaining: 0,
      reset: resetIn90Seconds,
      used: 60,
    };

    expect(getResetTimeFormatted(info)).toBe('1 minute');
  });

  it('should format multiple minutes', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetIn5Minutes = now + 300;

    const info: RateLimitInfo = {
      limit: 60,
      remaining: 0,
      reset: resetIn5Minutes,
      used: 60,
    };

    expect(getResetTimeFormatted(info)).toBe('5 minutes');
  });

  it('should format 1 hour', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetIn1Hour = now + 3600;

    const info: RateLimitInfo = {
      limit: 60,
      remaining: 0,
      reset: resetIn1Hour,
      used: 60,
    };

    expect(getResetTimeFormatted(info)).toBe('1 hour');
  });

  it('should format hours and minutes', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetIn90Minutes = now + 5400; // 1h 30m

    const info: RateLimitInfo = {
      limit: 60,
      remaining: 0,
      reset: resetIn90Minutes,
      used: 60,
    };

    expect(getResetTimeFormatted(info)).toBe('1 hour 30 minutes');
  });

  it('should format multiple hours', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetIn2Hours = now + 7200;

    const info: RateLimitInfo = {
      limit: 60,
      remaining: 0,
      reset: resetIn2Hours,
      used: 60,
    };

    expect(getResetTimeFormatted(info)).toBe('2 hours');
  });
});

describe('getRateLimitStatus', () => {
  it('should return complete status for limited state', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetIn60Seconds = now + 60;

    const info: RateLimitInfo = {
      limit: 60,
      remaining: 0,
      reset: resetIn60Seconds,
      used: 60,
    };

    const status = getRateLimitStatus(info);

    expect(status.isLimited).toBe(true);
    expect(status.info).toEqual(info);
    expect(status.resetIn).toBeGreaterThanOrEqual(59000);
    expect(status.resetIn).toBeLessThanOrEqual(61000);
  });

  it('should return complete status for non-limited state', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetIn60Seconds = now + 60;

    const info: RateLimitInfo = {
      limit: 60,
      remaining: 45,
      reset: resetIn60Seconds,
      used: 15,
    };

    const status = getRateLimitStatus(info);

    expect(status.isLimited).toBe(false);
    expect(status.info).toEqual(info);
    expect(status.resetIn).toBeGreaterThanOrEqual(59000);
  });
});

describe('RateLimitTracker', () => {
  beforeEach(() => {
    rateLimitTracker.reset();
  });

  it('should start with no info', () => {
    expect(rateLimitTracker.getInfo()).toBeNull();
    expect(rateLimitTracker.getStatus()).toBeNull();
    expect(rateLimitTracker.isLimited()).toBe(false);
  });

  it('should update info from headers', () => {
    const headers = new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '45',
      'x-ratelimit-reset': '1700000000',
    });

    rateLimitTracker.update(headers);

    const info = rateLimitTracker.getInfo();
    expect(info).toEqual({
      limit: 60,
      remaining: 45,
      reset: 1700000000,
      used: 15,
    });
  });

  it('should not update with invalid headers', () => {
    const headers = new Headers();
    rateLimitTracker.update(headers);

    expect(rateLimitTracker.getInfo()).toBeNull();
  });

  it('should update multiple times', () => {
    const headers1 = new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '45',
      'x-ratelimit-reset': '1700000000',
    });

    rateLimitTracker.update(headers1);
    expect(rateLimitTracker.getInfo()?.remaining).toBe(45);

    const headers2 = new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '30',
      'x-ratelimit-reset': '1700000000',
    });

    rateLimitTracker.update(headers2);
    expect(rateLimitTracker.getInfo()?.remaining).toBe(30);
  });

  it('should detect rate limit', () => {
    const headers = new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1700000000',
    });

    rateLimitTracker.update(headers);
    expect(rateLimitTracker.isLimited()).toBe(true);
  });

  it('should return status', () => {
    const now = Math.floor(Date.now() / 1000);
    const resetIn60Seconds = now + 60;

    const headers = new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '45',
      'x-ratelimit-reset': String(resetIn60Seconds),
    });

    rateLimitTracker.update(headers);

    const status = rateLimitTracker.getStatus();
    expect(status).not.toBeNull();
    expect(status?.isLimited).toBe(false);
    expect(status?.info.remaining).toBe(45);
  });

  it('should reset properly', () => {
    const headers = new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '45',
      'x-ratelimit-reset': '1700000000',
    });

    rateLimitTracker.update(headers);
    expect(rateLimitTracker.getInfo()).not.toBeNull();

    rateLimitTracker.reset();
    expect(rateLimitTracker.getInfo()).toBeNull();
  });
});
