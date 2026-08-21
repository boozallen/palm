import axios from 'axios';
import logger from '@/server/logger';

export type GitHubProviderConfig = {
  accessToken: string;
  apiBaseUrl: string;
};

export type PushFileOptions = {
  owner: string;
  repo: string;
  content: string;
  filePath: string;
  commitMessage: string;
  branch?: string;
};

export type PushFileResult = {
  success: boolean;
  action: 'created' | 'updated';
  filePath: string;
  url: string;
  downloadUrl: string;
  commit: {
    sha: string;
    message: string;
  };
};

export type GetFileOptions = {
  owner: string;
  repo: string;
  filePath: string;
  branch?: string;
};

export type GetFileResult = {
  content: string;
  sha: string;
  url: string;
  downloadUrl: string;
};

export type ListDirectoryOptions = {
  owner: string;
  repo: string;
  dirPath: string;
  branch?: string;
};

export type ListDirectoryItem = {
  name: string;
  path: string;
  type: 'file' | 'dir';
};

export type GetBinaryFileOptions = {
  owner: string;
  repo: string;
  filePath: string;
  branch?: string;
};

export type GetBinaryFileResult = {
  content: Buffer;
  sha: string;
  url: string;
  downloadUrl: string;
};

export class GitHubSource {
  private config: GitHubProviderConfig;

  constructor(config: GitHubProviderConfig) {
    this.config = config;
  }

  private getHeaders() {
    return {
      'Authorization': `token ${this.config.accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PALM-GitHub-Provider',
    };
  }

  private getApiUrl(owner: string, repo: string, filePath: string): string {
    const base = this.config.apiBaseUrl.replace(/\/+$/, '');
    return `${base}/repos/${owner}/${repo}/contents/${filePath}`;
  }

  async pushFile({
    owner,
    repo,
    content,
    filePath,
    commitMessage,
    branch = 'main',
  }: PushFileOptions): Promise<PushFileResult> {
    if (!content) {
      throw new Error('File content is required');
    }

    if (!filePath) {
      throw new Error('File path is required');
    }

    if (!commitMessage) {
      throw new Error('Commit message is required');
    }

    const apiUrl = this.getApiUrl(owner, repo, filePath);
    const headers = this.getHeaders();

    try {
      // Check if file already exists (to get SHA for updates)
      let existingSha: string | null = null;
      try {
        const existingFile = await axios.get(apiUrl, {
          headers,
          params: { ref: branch },
        });
        existingSha = existingFile.data.sha;
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          throw error;
        }
        // File doesn't exist, will create new file
      }

      // Encode content to base64
      const contentBase64 = Buffer.from(content).toString('base64');

      // Create or update file
      const payload: {
        message: string;
        content: string;
        branch: string;
        sha?: string;
      } = {
        message: commitMessage,
        content: contentBase64,
        branch,
      };

      if (existingSha) {
        payload.sha = existingSha;
      }

      const response = await axios.put(apiUrl, payload, { headers });

      return {
        success: true,
        action: existingSha ? 'updated' : 'created',
        filePath,
        url: response.data.content.html_url,
        downloadUrl: response.data.content.download_url,
        commit: {
          sha: response.data.commit.sha,
          message: commitMessage,
        },
      };
    } catch (error) {
      logger.error('Error pushing file to GitHub', { error, filePath, repo: `${owner}/${repo}` });
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        throw new Error(`Failed to push file to GitHub (${status}): ${message}`);
      }
      throw error;
    }
  }

  async getFile({
    owner,
    repo,
    filePath,
    branch = 'main',
  }: GetFileOptions): Promise<GetFileResult> {
    if (!filePath) {
      throw new Error('File path is required');
    }

    const apiUrl = this.getApiUrl(owner, repo, filePath);
    const headers = this.getHeaders();

    try {
      const response = await axios.get(apiUrl, {
        headers,
        params: { ref: branch },
      });

      let content: string;

      if (response.data.content) {
        content = Buffer.from(response.data.content, 'base64').toString('utf8');
      } else if (response.data.download_url) {
        // For files > 1MB, GitHub API does not return content field
        // Must use download_url instead
        const rawResponse = await axios.get(response.data.download_url, {
          headers: this.getHeaders(),
          responseType: 'text',
        });
        content = rawResponse.data;
      } else {
        throw new Error('GitHub API returned no content or download URL');
      }

      return {
        content,
        sha: response.data.sha,
        url: response.data.html_url,
        downloadUrl: response.data.download_url,
      };
    } catch (error) {
      logger.error('Error getting file from GitHub', { error, filePath, repo: `${owner}/${repo}` });
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        throw new Error(`Failed to get file from GitHub (${status}): ${message}`);
      }
      throw error;
    }
  }

  async getBinaryFile({
    owner,
    repo,
    filePath,
    branch = 'main',
  }: GetBinaryFileOptions): Promise<GetBinaryFileResult> {
    if (!filePath) {
      throw new Error('File path is required');
    }

    const apiUrl = this.getApiUrl(owner, repo, filePath);
    const headers = this.getHeaders();

    try {
      const response = await axios.get(apiUrl, {
        headers,
        params: { ref: branch },
      });

      let content: Buffer;

      if (response.data.content) {
        content = Buffer.from(response.data.content, 'base64');
      } else if (response.data.download_url) {
        const rawResponse = await axios.get(response.data.download_url, {
          headers: this.getHeaders(),
          responseType: 'arraybuffer',
        });
        content = Buffer.from(rawResponse.data);
      } else {
        throw new Error('GitHub API returned no content or download URL');
      }

      return {
        content,
        sha: response.data.sha,
        url: response.data.html_url,
        downloadUrl: response.data.download_url,
      };
    } catch (error) {
      logger.error('Error getting binary file from GitHub', { error, filePath, repo: `${owner}/${repo}` });
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        throw new Error(`Failed to get binary file from GitHub (${status}): ${message}`);
      }
      throw error;
    }
  }

  async listDirectory({
    owner,
    repo,
    dirPath,
    branch = 'main',
  }: ListDirectoryOptions): Promise<ListDirectoryItem[]> {
    const apiUrl = this.getApiUrl(owner, repo, dirPath);
    const headers = this.getHeaders();

    try {
      const response = await axios.get(apiUrl, {
        headers,
        params: { ref: branch },
      });

      if (!Array.isArray(response.data)) {
        return [];
      }

      return response.data.map((item: { name: string; path: string; type: string }) => ({
        name: item.name,
        path: item.path,
        type: item.type as 'file' | 'dir',
      }));
    } catch (error) {
      logger.error('Error listing directory from GitHub', { error, dirPath, repo: `${owner}/${repo}` });
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        throw new Error(`Failed to list directory from GitHub (${status}): ${message}`);
      }
      throw error;
    }
  }

  async deleteFile({
    owner,
    repo,
    filePath,
    commitMessage,
    branch = 'main',
  }: {
    owner: string;
    repo: string;
    filePath: string;
    commitMessage: string;
    branch?: string;
  }): Promise<void> {
    if (!filePath) {
      throw new Error('File path is required');
    }

    if (!commitMessage) {
      throw new Error('Commit message is required');
    }

    const apiUrl = this.getApiUrl(owner, repo, filePath);
    const headers = this.getHeaders();

    try {
      // Get current file SHA
      const existingFile = await axios.get(apiUrl, {
        headers,
        params: { ref: branch },
      });

      const sha = existingFile.data.sha;

      // Delete file
      await axios.delete(apiUrl, {
        headers,
        data: {
          message: commitMessage,
          sha,
          branch,
        },
      });
    } catch (error) {
      logger.error('Error deleting file from GitHub', { error, filePath, repo: `${owner}/${repo}` });
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        throw new Error(`Failed to delete file from GitHub (${status}): ${message}`);
      }
      throw error;
    }
  }
}
