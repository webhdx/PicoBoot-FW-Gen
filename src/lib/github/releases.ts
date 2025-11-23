/**
 * GitHub Releases Fetcher with Cache
 *
 * Provides high-level API for fetching releases with automatic caching.
 * Cache strategy:
 * - Releases metadata: 1 hour TTL
 * - Base firmware files: 1 hour TTL
 * - Payload files: 1 hour TTL
 */

import { githubClient, type GitHubAPIClient } from './api';
import * as cache from '../storage/cache';
import type { GitHubRelease, GitHubAsset } from '../../types/github';

export interface FetchReleasesOptions {
  /**
   * Force refresh (bypass cache)
   */
  forceRefresh?: boolean;

  /**
   * Custom TTL in milliseconds (default: 1 hour)
   */
  ttl?: number;
}

export interface DownloadAssetOptions extends FetchReleasesOptions {
  /**
   * Progress callback (loaded bytes, total bytes)
   */
  onProgress?: (loaded: number, total: number) => void;
}

/**
 * Generates cache key for releases
 */
function getReleasesCacheKey(owner: string, repo: string): string {
  return `github-releases:${owner}/${repo}`;
}

/**
 * Generates cache key for a specific release
 */
function getReleaseCacheKey(
  owner: string,
  repo: string,
  tag: string
): string {
  return `github-release:${owner}/${repo}:${tag}`;
}

/**
 * Generates cache key for firmware file
 */
function getFirmwareCacheKey(
  owner: string,
  repo: string,
  tag: string,
  assetName: string
): string {
  return `base-firmware:${owner}/${repo}:${tag}:${assetName}`;
}

/**
 * Generates cache key for payload file
 */
function getPayloadCacheKey(
  owner: string,
  repo: string,
  tag: string,
  assetName: string
): string {
  return `payload:${owner}/${repo}:${tag}:${assetName}`;
}

/**
 * Fetches all releases for a repository with caching
 */
export async function fetchReleases(
  owner: string,
  repo: string,
  options: FetchReleasesOptions = {}
): Promise<GitHubRelease[]> {
  const cacheKey = getReleasesCacheKey(owner, repo);

  // Try cache first unless force refresh
  if (!options.forceRefresh) {
    const cached = await cache.get<GitHubRelease[]>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Fetch from API
  const releases = await githubClient.getReleases(owner, repo);

  // Store in cache
  const ttl = options.ttl ?? cache.DEFAULT_TTL;
  await cache.set(cacheKey, releases, 'github-releases', ttl);

  return releases;
}

/**
 * Fetches a specific release by tag with caching
 */
export async function fetchReleaseByTag(
  owner: string,
  repo: string,
  tag: string,
  options: FetchReleasesOptions = {}
): Promise<GitHubRelease> {
  const cacheKey = getReleaseCacheKey(owner, repo, tag);

  // Try cache first unless force refresh
  if (!options.forceRefresh) {
    const cached = await cache.get<GitHubRelease>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Fetch from API
  const release = await githubClient.getReleaseByTag(owner, repo, tag);

  // Store in cache
  const ttl = options.ttl ?? cache.DEFAULT_TTL;
  await cache.set(cacheKey, release, 'github-releases', ttl);

  return release;
}

/**
 * Fetches the latest release with caching
 */
export async function fetchLatestRelease(
  owner: string,
  repo: string,
  options: FetchReleasesOptions = {}
): Promise<GitHubRelease> {
  const cacheKey = getReleaseCacheKey(owner, repo, 'latest');

  // Try cache first unless force refresh
  if (!options.forceRefresh) {
    const cached = await cache.get<GitHubRelease>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Fetch from API
  const release = await githubClient.getLatestRelease(owner, repo);

  // Store in cache
  const ttl = options.ttl ?? cache.DEFAULT_TTL;
  await cache.set(cacheKey, release, 'github-releases', ttl);

  return release;
}

/**
 * Downloads a firmware asset with caching
 */
export async function downloadFirmwareAsset(
  owner: string,
  repo: string,
  tag: string,
  assetId: number,
  assetName: string,
  options: DownloadAssetOptions = {}
): Promise<Uint8Array> {
  const cacheKey = getFirmwareCacheKey(owner, repo, tag, assetName);

  // Try cache first unless force refresh
  if (!options.forceRefresh) {
    const cached = await cache.get<Uint8Array>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Download from API
  const data = await githubClient.downloadAsset(
    owner,
    repo,
    assetId,
    options.onProgress
  );

  // Store in cache
  const ttl = options.ttl ?? cache.DEFAULT_TTL;
  await cache.set(cacheKey, data, 'firmware', ttl);

  return data;
}

/**
 * Downloads a payload asset with caching
 */
export async function downloadPayloadAsset(
  owner: string,
  repo: string,
  tag: string,
  assetId: number,
  assetName: string,
  options: DownloadAssetOptions = {}
): Promise<Uint8Array> {
  const cacheKey = getPayloadCacheKey(owner, repo, tag, assetName);

  // Try cache first unless force refresh
  if (!options.forceRefresh) {
    const cached = await cache.get<Uint8Array>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Download from API
  const data = await githubClient.downloadAsset(
    owner,
    repo,
    assetId,
    options.onProgress
  );

  // Store in cache
  const ttl = options.ttl ?? cache.DEFAULT_TTL;
  await cache.set(cacheKey, data, 'payload', ttl);

  return data;
}

/**
 * Finds and downloads a firmware asset by pattern
 */
export async function downloadFirmwareAssetByPattern(
  owner: string,
  repo: string,
  tag: string,
  pattern: string | RegExp,
  options: DownloadAssetOptions = {}
): Promise<{ asset: GitHubAsset; data: Uint8Array } | null> {
  // Get release
  const release = await fetchReleaseByTag(owner, repo, tag, options);

  // Find asset
  const asset = githubClient.findAsset(release, pattern);
  if (!asset) {
    return null;
  }

  // Download asset
  const data = await downloadFirmwareAsset(
    owner,
    repo,
    tag,
    asset.id,
    asset.name,
    options
  );

  return { asset, data };
}

/**
 * Finds and downloads a payload asset by pattern
 */
export async function downloadPayloadAssetByPattern(
  owner: string,
  repo: string,
  tag: string,
  pattern: string | RegExp,
  options: DownloadAssetOptions = {}
): Promise<{ asset: GitHubAsset; data: Uint8Array } | null> {
  // Get release
  const release = await fetchReleaseByTag(owner, repo, tag, options);

  // Find asset
  const asset = githubClient.findAsset(release, pattern);
  if (!asset) {
    return null;
  }

  // Download asset
  const data = await downloadPayloadAsset(
    owner,
    repo,
    tag,
    asset.id,
    asset.name,
    options
  );

  return { asset, data };
}

/**
 * Clears all cached releases for a repository
 */
export async function clearReleasesCache(
  owner: string,
  repo: string
): Promise<void> {
  const cacheKey = getReleasesCacheKey(owner, repo);
  await cache.remove(cacheKey);
}

/**
 * Clears all firmware cache
 */
export async function clearFirmwareCache(): Promise<number> {
  return cache.clearType('firmware');
}

/**
 * Clears all payload cache
 */
export async function clearPayloadCache(): Promise<number> {
  return cache.clearType('payload');
}

/**
 * Clears all GitHub releases cache
 */
export async function clearAllReleasesCache(): Promise<number> {
  return cache.clearType('github-releases');
}
