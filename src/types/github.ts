/**
 * GitHub API Types
 */

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: GitHubAsset[];
  body: string;
}

export interface GitHubAsset {
  id: number;
  name: string;
  label: string | null;
  content_type: string;
  size: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
  url: string; // API URL for downloading
}

export interface GitHubErrorResponse {
  message: string;
  documentation_url?: string;
}

export interface GitHubAPIError extends Error {
  status: number;
  response?: GitHubErrorResponse;
}
