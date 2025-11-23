/**
 * GitHub API Client
 *
 * Client for interacting with GitHub REST API v3.
 * Uses Assets API with Accept: application/octet-stream for binary downloads.
 *
 * Rate limiting: 60 requests/hour for unauthenticated requests
 */

import { ofetch } from 'ofetch';
import { rateLimitTracker } from './rate-limit';
import type { GitHubRelease, GitHubAsset, GitHubAPIError } from '../../types/github';

const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubClientOptions {
  /**
   * Custom base URL for GitHub API (for testing)
   */
  baseURL?: string;

  /**
   * Custom fetch function (for testing)
   */
  fetch?: typeof fetch;
}

export class GitHubRateLimitError extends Error implements GitHubAPIError {
  status = 429;
  resetTime: number;

  constructor(message: string, resetTime: number) {
    super(message);
    this.name = 'GitHubRateLimitError';
    this.resetTime = resetTime;
  }
}

export class GitHubNotFoundError extends Error implements GitHubAPIError {
  status = 404;

  constructor(message: string) {
    super(message);
    this.name = 'GitHubNotFoundError';
  }
}

export class GitHubAPIClient {
  private baseURL: string;
  private customFetch?: typeof fetch;

  constructor(options: GitHubClientOptions = {}) {
    this.baseURL = options.baseURL || GITHUB_API_BASE;
    this.customFetch = options.fetch;
  }

  /**
   * Makes a request to GitHub API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/vnd.github.v3+json');
    headers.set('User-Agent', 'PicoBoot-Firmware-Generator');

    try {
      const response = await ofetch.raw<T>(url, {
        ...options,
        headers: Object.fromEntries(headers.entries()),
        fetch: this.customFetch,
      });

      // Update rate limit tracker from response headers
      rateLimitTracker.update(response.headers);

      return response._data;
    } catch (error: any) {
      // Update rate limit if headers are present
      if (error.response?.headers) {
        rateLimitTracker.update(error.response.headers);
      }

      // Handle rate limit (429)
      if (error.status === 429) {
        const status = rateLimitTracker.getStatus();
        const resetTime = status?.resetIn || 3600000; // Default 1h
        throw new GitHubRateLimitError(
          'GitHub API rate limit exceeded',
          resetTime
        );
      }

      // Handle not found (404)
      if (error.status === 404) {
        throw new GitHubNotFoundError(
          `Resource not found: ${endpoint}`
        );
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Fetches all releases for a repository
   */
  async getReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
    return this.request<GitHubRelease[]>(`/repos/${owner}/${repo}/releases`);
  }

  /**
   * Fetches a specific release by tag
   */
  async getReleaseByTag(
    owner: string,
    repo: string,
    tag: string
  ): Promise<GitHubRelease> {
    return this.request<GitHubRelease>(
      `/repos/${owner}/${repo}/releases/tags/${tag}`
    );
  }

  /**
   * Gets the latest release
   */
  async getLatestRelease(
    owner: string,
    repo: string
  ): Promise<GitHubRelease> {
    return this.request<GitHubRelease>(
      `/repos/${owner}/${repo}/releases/latest`
    );
  }

  /**
   * Downloads an asset as binary data using Assets API
   */
  async downloadAsset(
    owner: string,
    repo: string,
    assetId: number,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Uint8Array> {
    const url = `${this.baseURL}/repos/${owner}/${repo}/releases/assets/${assetId}`;

    const headers = new Headers();
    headers.set('Accept', 'application/octet-stream');
    headers.set('User-Agent', 'PicoBoot-Firmware-Generator');

    try {
      const response = await fetch(url, {
        headers: Object.fromEntries(headers.entries()),
      });

      // Update rate limit tracker
      rateLimitTracker.update(response.headers);

      if (!response.ok) {
        if (response.status === 429) {
          const status = rateLimitTracker.getStatus();
          const resetTime = status?.resetIn || 3600000;
          throw new GitHubRateLimitError(
            'GitHub API rate limit exceeded',
            resetTime
          );
        }

        if (response.status === 404) {
          throw new GitHubNotFoundError(
            `Asset not found: ${assetId}`
          );
        }

        throw new Error(`Failed to download asset: ${response.statusText}`);
      }

      // Get content length for progress tracking
      const contentLength = parseInt(
        response.headers.get('Content-Length') || '0',
        10
      );

      // Read response body with progress tracking
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const chunks: Uint8Array[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        chunks.push(value);
        loaded += value.length;

        if (onProgress && contentLength > 0) {
          onProgress(loaded, contentLength);
        }
      }

      // Combine chunks into single Uint8Array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result;
    } catch (error) {
      if (
        error instanceof GitHubRateLimitError ||
        error instanceof GitHubNotFoundError
      ) {
        throw error;
      }

      throw new Error(
        `Failed to download asset: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Finds an asset by name pattern
   */
  findAsset(
    release: GitHubRelease,
    pattern: string | RegExp
  ): GitHubAsset | null {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    return release.assets.find((asset) => regex.test(asset.name)) || null;
  }
}

// Export singleton instance
export const githubClient = new GitHubAPIClient();
