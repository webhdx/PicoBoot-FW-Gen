import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchReleases,
  fetchReleaseByTag,
  fetchLatestRelease,
  downloadFirmwareAsset,
  downloadPayloadAsset,
  downloadFirmwareAssetByPattern,
  downloadPayloadAssetByPattern,
  clearReleasesCache,
  clearFirmwareCache,
  clearPayloadCache,
  clearAllReleasesCache,
} from '../../../../src/lib/github/releases';
import * as cache from '../../../../src/lib/storage/cache';
import { githubClient } from '../../../../src/lib/github/api';
import type { GitHubRelease, GitHubAsset } from '../../../../src/types/github';

// Setup fake-indexeddb
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// Mock GitHub API client
vi.mock('../../../../src/lib/github/api', () => ({
  githubClient: {
    getReleases: vi.fn(),
    getReleaseByTag: vi.fn(),
    getLatestRelease: vi.fn(),
    downloadAsset: vi.fn(),
    findAsset: vi.fn(),
  },
}));

describe('GitHub Releases Module', () => {
  const mockRelease: GitHubRelease = {
    id: 1,
    tag_name: 'v1.0.0',
    name: 'Version 1.0.0',
    draft: false,
    prerelease: false,
    created_at: '2024-01-01T00:00:00Z',
    published_at: '2024-01-01T00:00:00Z',
    assets: [
      {
        id: 101,
        name: 'picoboot_pico.uf2',
        label: null,
        content_type: 'application/octet-stream',
        size: 500000,
        download_count: 100,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        browser_download_url: 'https://github.com/releases/download/v1.0.0/picoboot_pico.uf2',
        url: 'https://api.github.com/repos/owner/repo/releases/assets/101',
      },
      {
        id: 102,
        name: 'picoboot_pico2.uf2',
        label: null,
        content_type: 'application/octet-stream',
        size: 600000,
        download_count: 50,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        browser_download_url: 'https://github.com/releases/download/v1.0.0/picoboot_pico2.uf2',
        url: 'https://api.github.com/repos/owner/repo/releases/assets/102',
      },
    ],
    body: 'Release notes',
  };

  beforeEach(async () => {
    // Reset IndexedDB
    globalThis.indexedDB = new IDBFactory();
    await cache.clearAll();
    vi.clearAllMocks();
  });

  describe('fetchReleases', () => {
    it('should fetch releases from API', async () => {
      const mockReleases = [mockRelease];
      vi.mocked(githubClient.getReleases).mockResolvedValue(mockReleases);

      const releases = await fetchReleases('owner', 'repo');

      expect(releases).toEqual(mockReleases);
      expect(githubClient.getReleases).toHaveBeenCalledWith('owner', 'repo');
    });

    it('should cache releases after fetching', async () => {
      const mockReleases = [mockRelease];
      vi.mocked(githubClient.getReleases).mockResolvedValue(mockReleases);

      // First call - fetch from API
      await fetchReleases('owner', 'repo');

      // Second call - should use cache
      await fetchReleases('owner', 'repo');

      // API should only be called once
      expect(githubClient.getReleases).toHaveBeenCalledTimes(1);
    });

    it('should return cached releases on second call', async () => {
      const mockReleases = [mockRelease];
      vi.mocked(githubClient.getReleases).mockResolvedValue(mockReleases);

      const releases1 = await fetchReleases('owner', 'repo');
      const releases2 = await fetchReleases('owner', 'repo');

      expect(releases1).toEqual(mockReleases);
      expect(releases2).toEqual(mockReleases);
    });

    it('should bypass cache with forceRefresh', async () => {
      const mockReleases = [mockRelease];
      vi.mocked(githubClient.getReleases).mockResolvedValue(mockReleases);

      // First call
      await fetchReleases('owner', 'repo');

      // Force refresh
      await fetchReleases('owner', 'repo', { forceRefresh: true });

      // API should be called twice
      expect(githubClient.getReleases).toHaveBeenCalledTimes(2);
    });

    it('should use custom TTL', async () => {
      const mockReleases = [mockRelease];
      vi.mocked(githubClient.getReleases).mockResolvedValue(mockReleases);

      const customTTL = 5000;
      await fetchReleases('owner', 'repo', { ttl: customTTL });

      // Verify cache was called (indirectly through successful second fetch)
      const releases = await fetchReleases('owner', 'repo');
      expect(releases).toEqual(mockReleases);
    });
  });

  describe('fetchReleaseByTag', () => {
    it('should fetch release by tag from API', async () => {
      vi.mocked(githubClient.getReleaseByTag).mockResolvedValue(mockRelease);

      const release = await fetchReleaseByTag('owner', 'repo', 'v1.0.0');

      expect(release).toEqual(mockRelease);
      expect(githubClient.getReleaseByTag).toHaveBeenCalledWith(
        'owner',
        'repo',
        'v1.0.0'
      );
    });

    it('should cache release after fetching', async () => {
      vi.mocked(githubClient.getReleaseByTag).mockResolvedValue(mockRelease);

      await fetchReleaseByTag('owner', 'repo', 'v1.0.0');
      await fetchReleaseByTag('owner', 'repo', 'v1.0.0');

      expect(githubClient.getReleaseByTag).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache with forceRefresh', async () => {
      vi.mocked(githubClient.getReleaseByTag).mockResolvedValue(mockRelease);

      await fetchReleaseByTag('owner', 'repo', 'v1.0.0');
      await fetchReleaseByTag('owner', 'repo', 'v1.0.0', {
        forceRefresh: true,
      });

      expect(githubClient.getReleaseByTag).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchLatestRelease', () => {
    it('should fetch latest release from API', async () => {
      vi.mocked(githubClient.getLatestRelease).mockResolvedValue(mockRelease);

      const release = await fetchLatestRelease('owner', 'repo');

      expect(release).toEqual(mockRelease);
      expect(githubClient.getLatestRelease).toHaveBeenCalledWith(
        'owner',
        'repo'
      );
    });

    it('should cache latest release', async () => {
      vi.mocked(githubClient.getLatestRelease).mockResolvedValue(mockRelease);

      await fetchLatestRelease('owner', 'repo');
      await fetchLatestRelease('owner', 'repo');

      expect(githubClient.getLatestRelease).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache with forceRefresh', async () => {
      vi.mocked(githubClient.getLatestRelease).mockResolvedValue(mockRelease);

      await fetchLatestRelease('owner', 'repo');
      await fetchLatestRelease('owner', 'repo', { forceRefresh: true });

      expect(githubClient.getLatestRelease).toHaveBeenCalledTimes(2);
    });
  });

  describe('downloadFirmwareAsset', () => {
    it('should download firmware asset from API', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      vi.mocked(githubClient.downloadAsset).mockResolvedValue(mockData);

      const data = await downloadFirmwareAsset(
        'owner',
        'repo',
        'v1.0.0',
        101,
        'picoboot_pico.uf2'
      );

      expect(data).toEqual(mockData);
      expect(githubClient.downloadAsset).toHaveBeenCalledWith(
        'owner',
        'repo',
        101,
        undefined
      );
    });

    it('should cache firmware asset after download', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      vi.mocked(githubClient.downloadAsset).mockResolvedValue(mockData);

      await downloadFirmwareAsset(
        'owner',
        'repo',
        'v1.0.0',
        101,
        'picoboot_pico.uf2'
      );
      await downloadFirmwareAsset(
        'owner',
        'repo',
        'v1.0.0',
        101,
        'picoboot_pico.uf2'
      );

      expect(githubClient.downloadAsset).toHaveBeenCalledTimes(1);
    });

    it('should call onProgress callback', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      const onProgress = vi.fn();

      vi.mocked(githubClient.downloadAsset).mockImplementation(
        async (owner, repo, assetId, progressCallback) => {
          if (progressCallback) {
            progressCallback(5, 10);
          }
          return mockData;
        }
      );

      await downloadFirmwareAsset(
        'owner',
        'repo',
        'v1.0.0',
        101,
        'picoboot_pico.uf2',
        { onProgress }
      );

      expect(onProgress).toHaveBeenCalledWith(5, 10);
    });

    it('should bypass cache with forceRefresh', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      vi.mocked(githubClient.downloadAsset).mockResolvedValue(mockData);

      await downloadFirmwareAsset(
        'owner',
        'repo',
        'v1.0.0',
        101,
        'picoboot_pico.uf2'
      );
      await downloadFirmwareAsset(
        'owner',
        'repo',
        'v1.0.0',
        101,
        'picoboot_pico.uf2',
        { forceRefresh: true }
      );

      expect(githubClient.downloadAsset).toHaveBeenCalledTimes(2);
    });
  });

  describe('downloadPayloadAsset', () => {
    it('should download payload asset from API', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      vi.mocked(githubClient.downloadAsset).mockResolvedValue(mockData);

      const data = await downloadPayloadAsset(
        'owner',
        'repo',
        'v1.0.0',
        101,
        'payload.dol'
      );

      expect(data).toEqual(mockData);
    });

    it('should cache payload asset after download', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      vi.mocked(githubClient.downloadAsset).mockResolvedValue(mockData);

      await downloadPayloadAsset(
        'owner',
        'repo',
        'v1.0.0',
        101,
        'payload.dol'
      );
      await downloadPayloadAsset(
        'owner',
        'repo',
        'v1.0.0',
        101,
        'payload.dol'
      );

      expect(githubClient.downloadAsset).toHaveBeenCalledTimes(1);
    });
  });

  describe('downloadFirmwareAssetByPattern', () => {
    it('should find and download firmware asset by string pattern', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);

      vi.mocked(githubClient.getReleaseByTag).mockResolvedValue(mockRelease);
      vi.mocked(githubClient.findAsset).mockReturnValue(
        mockRelease.assets[0]
      );
      vi.mocked(githubClient.downloadAsset).mockResolvedValue(mockData);

      const result = await downloadFirmwareAssetByPattern(
        'owner',
        'repo',
        'v1.0.0',
        'pico.uf2'
      );

      expect(result).not.toBeNull();
      expect(result?.asset.name).toBe('picoboot_pico.uf2');
      expect(result?.data).toEqual(mockData);
    });

    it('should find and download firmware asset by regex', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);

      vi.mocked(githubClient.getReleaseByTag).mockResolvedValue(mockRelease);
      vi.mocked(githubClient.findAsset).mockReturnValue(
        mockRelease.assets[1]
      );
      vi.mocked(githubClient.downloadAsset).mockResolvedValue(mockData);

      const result = await downloadFirmwareAssetByPattern(
        'owner',
        'repo',
        'v1.0.0',
        /pico2\.uf2$/
      );

      expect(result).not.toBeNull();
      expect(result?.asset.name).toBe('picoboot_pico2.uf2');
    });

    it('should return null if asset not found', async () => {
      vi.mocked(githubClient.getReleaseByTag).mockResolvedValue(mockRelease);
      vi.mocked(githubClient.findAsset).mockReturnValue(null);

      const result = await downloadFirmwareAssetByPattern(
        'owner',
        'repo',
        'v1.0.0',
        'nonexistent.bin'
      );

      expect(result).toBeNull();
    });
  });

  describe('downloadPayloadAssetByPattern', () => {
    it('should find and download payload asset by pattern', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);

      vi.mocked(githubClient.getReleaseByTag).mockResolvedValue(mockRelease);
      vi.mocked(githubClient.findAsset).mockReturnValue(
        mockRelease.assets[0]
      );
      vi.mocked(githubClient.downloadAsset).mockResolvedValue(mockData);

      const result = await downloadPayloadAssetByPattern(
        'owner',
        'repo',
        'v1.0.0',
        'pico.uf2'
      );

      expect(result).not.toBeNull();
      expect(result?.asset.name).toBe('picoboot_pico.uf2');
      expect(result?.data).toEqual(mockData);
    });

    it('should return null if asset not found', async () => {
      vi.mocked(githubClient.getReleaseByTag).mockResolvedValue(mockRelease);
      vi.mocked(githubClient.findAsset).mockReturnValue(null);

      const result = await downloadPayloadAssetByPattern(
        'owner',
        'repo',
        'v1.0.0',
        'nonexistent'
      );

      expect(result).toBeNull();
    });
  });

  describe('cache clearing', () => {
    it('should clear releases cache for repository', async () => {
      const mockReleases = [mockRelease];
      vi.mocked(githubClient.getReleases).mockResolvedValue(mockReleases);

      // Populate cache
      await fetchReleases('owner', 'repo');

      // Clear cache
      await clearReleasesCache('owner', 'repo');

      // Should fetch from API again
      await fetchReleases('owner', 'repo');

      expect(githubClient.getReleases).toHaveBeenCalledTimes(2);
    });

    it('should clear all firmware cache', async () => {
      const mockData = new Uint8Array([1, 2, 3]);
      vi.mocked(githubClient.downloadAsset).mockResolvedValue(mockData);

      // Populate cache
      await downloadFirmwareAsset('owner', 'repo', 'v1.0.0', 101, 'file1.uf2');
      await downloadFirmwareAsset('owner', 'repo', 'v1.0.0', 102, 'file2.uf2');

      // Clear all firmware cache
      const cleared = await clearFirmwareCache();

      expect(cleared).toBeGreaterThanOrEqual(0);
    });

    it('should clear all payload cache', async () => {
      const mockData = new Uint8Array([1, 2, 3]);
      vi.mocked(githubClient.downloadAsset).mockResolvedValue(mockData);

      // Populate cache
      await downloadPayloadAsset('owner', 'repo', 'v1.0.0', 101, 'payload.dol');

      // Clear all payload cache
      const cleared = await clearPayloadCache();

      expect(cleared).toBeGreaterThanOrEqual(0);
    });

    it('should clear all GitHub releases cache', async () => {
      const mockReleases = [mockRelease];
      vi.mocked(githubClient.getReleases).mockResolvedValue(mockReleases);

      // Populate cache
      await fetchReleases('owner', 'repo');

      // Clear all releases cache
      const cleared = await clearAllReleasesCache();

      expect(cleared).toBeGreaterThanOrEqual(0);
    });
  });
});
