jest.mock('axios');
jest.mock('@/server/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import axios from 'axios';
import { GitHubSource } from './github';

const mockAxios = axios as jest.Mocked<typeof axios>;

const config = {
  accessToken: 'ghp_testtoken',
  apiBaseUrl: 'https://api.github.com',
};

const pushOptions = {
  owner: 'myorg',
  repo: 'my-repo',
  content: '# Hello',
  filePath: 'artifacts/chat-id/report.md',
  commitMessage: 'Add artifact: report',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAxios.isAxiosError.mockReturnValue(false);
});

describe('GitHubSource', () => {
  describe('pushFile', () => {
    it('creates a new file when it does not already exist', async () => {
      const axiosError = Object.assign(new Error('Not Found'), { response: { status: 404 } });
      mockAxios.isAxiosError.mockReturnValue(true);
      mockAxios.get.mockRejectedValueOnce(axiosError);
      mockAxios.put.mockResolvedValueOnce({
        data: {
          content: { html_url: 'https://github.com/myorg/my-repo/blob/main/artifacts/chat-id/report.md' },
          commit: { sha: 'abc123' },
        },
      });

      const source = new GitHubSource(config);
      const result = await source.pushFile(pushOptions);

      expect(result.success).toBe(true);
      expect(result.action).toBe('created');
      expect(result.commit.sha).toBe('abc123');
      expect(mockAxios.put).toHaveBeenCalledWith(
        'https://api.github.com/repos/myorg/my-repo/contents/artifacts/chat-id/report.md',
        expect.not.objectContaining({ sha: expect.anything() }),
        expect.any(Object),
      );
    });

    it('updates an existing file by including its SHA in the PUT payload', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { sha: 'existingsha' } });
      mockAxios.put.mockResolvedValueOnce({
        data: {
          content: { html_url: 'https://github.com/myorg/my-repo/blob/main/artifacts/chat-id/report.md' },
          commit: { sha: 'newsha' },
        },
      });

      const source = new GitHubSource(config);
      const result = await source.pushFile(pushOptions);

      expect(result.action).toBe('updated');
      expect(mockAxios.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ sha: 'existingsha' }),
        expect.any(Object),
      );
    });

    it('base64-encodes the file content before pushing', async () => {
      const axiosError = Object.assign(new Error('Not Found'), { response: { status: 404 } });
      mockAxios.isAxiosError.mockReturnValue(true);
      mockAxios.get.mockRejectedValueOnce(axiosError);
      mockAxios.put.mockResolvedValueOnce({
        data: {
          content: { html_url: 'https://github.com/myorg/my-repo/blob/main/file.md' },
          commit: { sha: 'sha' },
        },
      });

      const source = new GitHubSource(config);
      await source.pushFile({ ...pushOptions, content: 'hello' });

      expect(mockAxios.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ content: Buffer.from('hello').toString('base64') }),
        expect.any(Object),
      );
    });

    it('strips a trailing slash from apiBaseUrl when building the request URL', async () => {
      const axiosError = Object.assign(new Error('Not Found'), { response: { status: 404 } });
      mockAxios.isAxiosError.mockReturnValue(true);
      mockAxios.get.mockRejectedValueOnce(axiosError);
      mockAxios.put.mockResolvedValueOnce({
        data: {
          content: { html_url: 'https://github.com/myorg/my-repo/blob/main/file.md' },
          commit: { sha: 'sha' },
        },
      });

      const source = new GitHubSource({ ...config, apiBaseUrl: 'https://api.github.com/' });
      await source.pushFile(pushOptions);

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://api.github.com/repos/myorg/my-repo/contents/artifacts/chat-id/report.md',
        expect.any(Object),
      );
    });

    it('throws when content is empty', async () => {
      const source = new GitHubSource(config);
      await expect(source.pushFile({ ...pushOptions, content: '' })).rejects.toThrow(
        'File content is required',
      );
    });

    it('throws when filePath is empty', async () => {
      const source = new GitHubSource(config);
      await expect(source.pushFile({ ...pushOptions, filePath: '' })).rejects.toThrow(
        'File path is required',
      );
    });

    it('throws when commitMessage is empty', async () => {
      const source = new GitHubSource(config);
      await expect(source.pushFile({ ...pushOptions, commitMessage: '' })).rejects.toThrow(
        'Commit message is required',
      );
    });

    it('throws a descriptive error when the axios PUT fails', async () => {
      const axiosError = Object.assign(new Error('Not Found'), { response: { status: 404 } });
      mockAxios.isAxiosError.mockReturnValue(true);
      mockAxios.get.mockRejectedValueOnce(axiosError);

      const putError = Object.assign(new Error('Unprocessable Entity'), {
        response: { status: 422, data: { message: 'Invalid input' } },
      });
      mockAxios.isAxiosError.mockReturnValueOnce(true).mockReturnValue(true);
      mockAxios.put.mockRejectedValueOnce(putError);

      const source = new GitHubSource(config);
      await expect(source.pushFile(pushOptions)).rejects.toThrow(/Failed to push file to GitHub/);
    });
  });

  describe('getFile', () => {
    it('returns decoded file content and metadata', async () => {
      const rawContent = Buffer.from('file contents').toString('base64');
      mockAxios.get.mockResolvedValueOnce({
        data: {
          content: rawContent,
          sha: 'fileshaabc',
          html_url: 'https://github.com/myorg/my-repo/blob/main/file.md',
          download_url: 'https://raw.githubusercontent.com/myorg/my-repo/main/file.md',
        },
      });

      const source = new GitHubSource(config);
      const result = await source.getFile({ owner: 'myorg', repo: 'my-repo', filePath: 'file.md' });

      expect(result.content).toBe('file contents');
      expect(result.sha).toBe('fileshaabc');
    });

    it('throws when filePath is empty', async () => {
      const source = new GitHubSource(config);
      await expect(source.getFile({ owner: 'myorg', repo: 'my-repo', filePath: '' })).rejects.toThrow(
        'File path is required',
      );
    });

    it('throws a descriptive error on axios failure', async () => {
      const axiosError = Object.assign(new Error('Not Found'), {
        response: { status: 404, data: { message: 'Not Found' } },
      });
      mockAxios.isAxiosError.mockReturnValue(true);
      mockAxios.get.mockRejectedValueOnce(axiosError);

      const source = new GitHubSource(config);
      await expect(
        source.getFile({ owner: 'myorg', repo: 'my-repo', filePath: 'missing.md' }),
      ).rejects.toThrow(/Failed to get file from GitHub/);
    });
  });

  describe('getBinaryFile', () => {
    it('returns binary file content as Buffer', async () => {
      const binaryContent = Buffer.from('binary file contents').toString('base64');
      mockAxios.get.mockResolvedValueOnce({
        data: {
          content: binaryContent,
          sha: 'binaryshaabc',
          html_url: 'https://github.com/myorg/my-repo/blob/main/file.docx',
          download_url: 'https://raw.githubusercontent.com/myorg/my-repo/main/file.docx',
        },
      });

      const source = new GitHubSource(config);
      const result = await source.getBinaryFile({ owner: 'myorg', repo: 'my-repo', filePath: 'file.docx' });

      expect(result.content).toBeInstanceOf(Buffer);
      expect(result.content.toString()).toBe('binary file contents');
      expect(result.sha).toBe('binaryshaabc');
      expect(result.url).toBe('https://github.com/myorg/my-repo/blob/main/file.docx');
    });

    it('throws when filePath is empty', async () => {
      const source = new GitHubSource(config);
      await expect(source.getBinaryFile({ owner: 'myorg', repo: 'my-repo', filePath: '' })).rejects.toThrow(
        'File path is required',
      );
    });

    it('throws a descriptive error on axios failure', async () => {
      const axiosError = Object.assign(new Error('Not Found'), {
        response: { status: 404, data: { message: 'Not Found' } },
      });
      mockAxios.isAxiosError.mockReturnValue(true);
      mockAxios.get.mockRejectedValueOnce(axiosError);

      const source = new GitHubSource(config);
      await expect(
        source.getBinaryFile({ owner: 'myorg', repo: 'my-repo', filePath: 'missing.docx' }),
      ).rejects.toThrow(/Failed to get binary file from GitHub/);
    });
  });

  describe('listDirectory', () => {
    it('returns a mapped list of directory items', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: [
          { name: 'file.md', path: 'artifacts/file.md', type: 'file' },
          { name: 'subdir', path: 'artifacts/subdir', type: 'dir' },
        ],
      });

      const source = new GitHubSource(config);
      const result = await source.listDirectory({ owner: 'myorg', repo: 'my-repo', dirPath: 'artifacts' });

      expect(result).toEqual([
        { name: 'file.md', path: 'artifacts/file.md', type: 'file' },
        { name: 'subdir', path: 'artifacts/subdir', type: 'dir' },
      ]);
    });

    it('returns an empty array when the response is not an array', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { message: 'Not a directory' } });

      const source = new GitHubSource(config);
      const result = await source.listDirectory({ owner: 'myorg', repo: 'my-repo', dirPath: 'artifacts' });

      expect(result).toEqual([]);
    });

    it('throws a descriptive error on axios failure', async () => {
      const axiosError = Object.assign(new Error('Forbidden'), {
        response: { status: 403, data: { message: 'Forbidden' } },
      });
      mockAxios.isAxiosError.mockReturnValue(true);
      mockAxios.get.mockRejectedValueOnce(axiosError);

      const source = new GitHubSource(config);
      await expect(
        source.listDirectory({ owner: 'myorg', repo: 'my-repo', dirPath: 'artifacts' }),
      ).rejects.toThrow(/Failed to list directory from GitHub/);
    });
  });

  describe('deleteFile', () => {
    it('fetches the current SHA then sends a DELETE with it', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { sha: 'deleteme123' } });
      mockAxios.delete.mockResolvedValueOnce({});

      const source = new GitHubSource(config);
      await source.deleteFile({
        owner: 'myorg',
        repo: 'my-repo',
        filePath: 'artifacts/file.md',
        commitMessage: 'Remove artifact',
      });

      expect(mockAxios.delete).toHaveBeenCalledWith(
        'https://api.github.com/repos/myorg/my-repo/contents/artifacts/file.md',
        expect.objectContaining({
          data: expect.objectContaining({ sha: 'deleteme123' }),
        }),
      );
    });

    it('throws when filePath is empty', async () => {
      const source = new GitHubSource(config);
      await expect(
        source.deleteFile({ owner: 'myorg', repo: 'my-repo', filePath: '', commitMessage: 'Remove' }),
      ).rejects.toThrow('File path is required');
    });

    it('throws when commitMessage is empty', async () => {
      const source = new GitHubSource(config);
      await expect(
        source.deleteFile({ owner: 'myorg', repo: 'my-repo', filePath: 'file.md', commitMessage: '' }),
      ).rejects.toThrow('Commit message is required');
    });

    it('throws a descriptive error on axios failure', async () => {
      const axiosError = Object.assign(new Error('Not Found'), {
        response: { status: 404, data: { message: 'Not Found' } },
      });
      mockAxios.isAxiosError.mockReturnValue(true);
      mockAxios.get.mockRejectedValueOnce(axiosError);

      const source = new GitHubSource(config);
      await expect(
        source.deleteFile({
          owner: 'myorg',
          repo: 'my-repo',
          filePath: 'missing.md',
          commitMessage: 'Remove',
        }),
      ).rejects.toThrow(/Failed to delete file from GitHub/);
    });
  });
});
