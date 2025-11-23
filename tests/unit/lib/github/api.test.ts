import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  GitHubAPIClient,
  GitHubRateLimitError,
  GitHubNotFoundError,
} from '../../../../src/lib/github/api';
import { rateLimitTracker } from '../../../../src/lib/github/rate-limit';
import type { GitHubRelease, GitHubAsset } from '../../../../src/types/github';

// Mock ofetch
vi.mock('ofetch', () => ({
  ofetch: {
    raw: vi.fn(),
  },
}));

describe('GitHubAPIClient', () => {
  let client: GitHubAPIClient;
  let ofetchRaw: any;

  beforeEach(async () => {
    rateLimitTracker.reset();
    vi.clearAllMocks();
    const { ofetch } = await import('ofetch');
    ofetchRaw = ofetch.raw;
    client = new GitHubAPIClient({
      baseURL: 'https://api.github.test',
    });
  });

  const mockHeaders = () =>
    new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '59',
      'x-ratelimit-reset': '1700000000',
    });

  const mockResponse = <T>(data: T, headers = mockHeaders()) => ({
    _data: data,
    headers,
  });

  describe('getReleases', () => {
    it('should fetch releases list', async () => {
      const mockReleases: GitHubRelease[] = [
        {
          id: 1,
          tag_name: 'v1.0.0',
          name: 'Version 1.0.0',
          draft: false,
          prerelease: false,
          created_at: '2024-01-01T00:00:00Z',
          published_at: '2024-01-01T00:00:00Z',
          assets: [],
          body: 'Release notes',
        },
      ];

      ofetchRaw.mockResolvedValue(mockResponse(mockReleases));

      const releases = await client.getReleases('owner', 'repo');

      expect(releases).toEqual(mockReleases);
    });

    it('should update rate limit tracker', async () => {
      const headers = new Headers({
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '45',
        'x-ratelimit-reset': '1700000000',
      });

      ofetchRaw.mockResolvedValue(mockResponse([], headers));

      await client.getReleases('owner', 'repo');

      const info = rateLimitTracker.getInfo();
      expect(info?.remaining).toBe(45);
    });

    it('should throw GitHubRateLimitError on 429', async () => {
      const headers = new Headers({
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
      });

      ofetchRaw.mockRejectedValue({
        status: 429,
        response: { headers },
      });

      await expect(client.getReleases('owner', 'repo')).rejects.toThrow(
        GitHubRateLimitError
      );
    });

    it('should throw GitHubNotFoundError on 404', async () => {
      ofetchRaw.mockRejectedValue({
        status: 404,
        response: { headers: mockHeaders() },
      });

      await expect(client.getReleases('owner', 'repo')).rejects.toThrow(
        GitHubNotFoundError
      );
    });
  });

  describe('getReleaseByTag', () => {
    it('should fetch specific release by tag', async () => {
      const mockRelease: GitHubRelease = {
        id: 1,
        tag_name: 'v1.0.0',
        name: 'Version 1.0.0',
        draft: false,
        prerelease: false,
        created_at: '2024-01-01T00:00:00Z',
        published_at: '2024-01-01T00:00:00Z',
        assets: [],
        body: 'Release notes',
      };

      ofetchRaw.mockResolvedValue(mockResponse(mockRelease));

      const release = await client.getReleaseByTag('owner', 'repo', 'v1.0.0');

      expect(release).toEqual(mockRelease);
    });
  });

  describe('getLatestRelease', () => {
    it('should fetch latest release', async () => {
      const mockRelease: GitHubRelease = {
        id: 1,
        tag_name: 'v2.0.0',
        name: 'Version 2.0.0',
        draft: false,
        prerelease: false,
        created_at: '2024-01-01T00:00:00Z',
        published_at: '2024-01-01T00:00:00Z',
        assets: [],
        body: 'Latest release',
      };

      ofetchRaw.mockResolvedValue(mockResponse(mockRelease));

      const release = await client.getLatestRelease('owner', 'repo');

      expect(release).toEqual(mockRelease);
    });
  });

  describe('downloadAsset', () => {
    beforeEach(() => {
      global.fetch = vi.fn() as any;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should download asset as binary data', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: mockData })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockFetchResponse = {
        ok: true,
        headers: mockHeaders(),
        body: {
          getReader: () => mockReader,
        },
      };

      (global.fetch as any).mockResolvedValue(mockFetchResponse);

      const data = await client.downloadAsset('owner', 'repo', 123);

      expect(data).toEqual(mockData);
    });

    it('should call progress callback', async () => {
      const chunk1 = new Uint8Array([1, 2, 3]);
      const chunk2 = new Uint8Array([4, 5]);
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: chunk1 })
          .mockResolvedValueOnce({ done: false, value: chunk2 })
          .mockResolvedValueOnce({ done: true }),
      };

      const headers = new Headers(mockHeaders());
      headers.set('Content-Length', '5');

      const mockFetchResponse = {
        ok: true,
        headers,
        body: {
          getReader: () => mockReader,
        },
      };

      (global.fetch as any).mockResolvedValue(mockFetchResponse);

      const onProgress = vi.fn();
      await client.downloadAsset('owner', 'repo', 123, onProgress);

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 3, 5);
      expect(onProgress).toHaveBeenNthCalledWith(2, 5, 5);
    });

    it('should combine multiple chunks', async () => {
      const chunk1 = new Uint8Array([1, 2]);
      const chunk2 = new Uint8Array([3, 4]);
      const chunk3 = new Uint8Array([5]);
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: chunk1 })
          .mockResolvedValueOnce({ done: false, value: chunk2 })
          .mockResolvedValueOnce({ done: false, value: chunk3 })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockFetchResponse = {
        ok: true,
        headers: mockHeaders(),
        body: {
          getReader: () => mockReader,
        },
      };

      (global.fetch as any).mockResolvedValue(mockFetchResponse);

      const data = await client.downloadAsset('owner', 'repo', 123);

      expect(data).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('should throw GitHubRateLimitError on 429', async () => {
      const headers = new Headers({
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
      });

      const mockFetchResponse = {
        ok: false,
        status: 429,
        headers,
      };

      (global.fetch as any).mockResolvedValue(mockFetchResponse);

      await expect(
        client.downloadAsset('owner', 'repo', 123)
      ).rejects.toThrow(GitHubRateLimitError);
    });

    it('should throw GitHubNotFoundError on 404', async () => {
      const mockFetchResponse = {
        ok: false,
        status: 404,
        headers: mockHeaders(),
      };

      (global.fetch as any).mockResolvedValue(mockFetchResponse);

      await expect(
        client.downloadAsset('owner', 'repo', 123)
      ).rejects.toThrow(GitHubNotFoundError);
    });

    it('should throw error if body is not readable', async () => {
      const mockFetchResponse = {
        ok: true,
        headers: mockHeaders(),
        body: null,
      };

      (global.fetch as any).mockResolvedValue(mockFetchResponse);

      await expect(
        client.downloadAsset('owner', 'repo', 123)
      ).rejects.toThrow('Response body is not readable');
    });
  });

  describe('findAsset', () => {
    const mockAssets: GitHubAsset[] = [
      {
        id: 1,
        name: 'picoboot_pico.uf2',
        label: null,
        content_type: 'application/octet-stream',
        size: 500000,
        download_count: 100,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        browser_download_url:
          'https://github.com/releases/download/v1.0.0/picoboot_pico.uf2',
        url: 'https://api.github.com/repos/owner/repo/releases/assets/1',
      },
      {
        id: 2,
        name: 'picoboot_pico2.uf2',
        label: null,
        content_type: 'application/octet-stream',
        size: 600000,
        download_count: 50,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        browser_download_url:
          'https://github.com/releases/download/v1.0.0/picoboot_pico2.uf2',
        url: 'https://api.github.com/repos/owner/repo/releases/assets/2',
      },
    ];

    const mockRelease: GitHubRelease = {
      id: 1,
      tag_name: 'v1.0.0',
      name: 'Version 1.0.0',
      draft: false,
      prerelease: false,
      created_at: '2024-01-01T00:00:00Z',
      published_at: '2024-01-01T00:00:00Z',
      assets: mockAssets,
      body: 'Release notes',
    };

    it('should find asset by string pattern', () => {
      const asset = client.findAsset(mockRelease, 'pico.uf2');
      expect(asset).not.toBeNull();
      expect(asset?.name).toBe('picoboot_pico.uf2');
    });

    it('should find asset by regex', () => {
      const asset = client.findAsset(mockRelease, /pico2\.uf2$/);
      expect(asset).not.toBeNull();
      expect(asset?.name).toBe('picoboot_pico2.uf2');
    });

    it('should return null if no match', () => {
      const asset = client.findAsset(mockRelease, 'nonexistent.bin');
      expect(asset).toBeNull();
    });

    it('should return first match for multiple matches', () => {
      const asset = client.findAsset(mockRelease, /\.uf2$/);
      expect(asset).not.toBeNull();
      expect(asset?.name).toBe('picoboot_pico.uf2');
    });
  });
});
