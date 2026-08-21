import { getGitHubBaseUrl, getGitHubInstanceName } from './githubHelpers';

describe('githubHelpers', () => {
  describe('getGitHubInstanceName', () => {
    it('returns GitHub.com for api.github.com', () => {
      expect(getGitHubInstanceName('https://api.github.com')).toBe('GitHub.com');
    });

    it('returns the hostname for GitHub Enterprise', () => {
      expect(getGitHubInstanceName('https://github.example.com/api/v3')).toBe('github.example.com');
    });

    it('returns GitHub for an invalid URL', () => {
      expect(getGitHubInstanceName('not-a-url')).toBe('GitHub');
    });
  });

  describe('getGitHubBaseUrl', () => {
    it('should convert api.github.com to github.com', () => {
      expect(getGitHubBaseUrl('https://api.github.com')).toBe('https://github.com');
    });

    it('should remove /api/v3 from GitHub Enterprise URL', () => {
      expect(getGitHubBaseUrl('https://github.example.com/api/v3')).toBe('https://github.example.com');
    });

    it('should remove /api from GitHub Enterprise URL', () => {
      expect(getGitHubBaseUrl('https://github.example.com/api')).toBe('https://github.example.com');
    });

    it('should handle GitHub Enterprise URL with port', () => {
      expect(getGitHubBaseUrl('https://github.example.com:8443/api/v3')).toBe('https://github.example.com:8443');
    });

    it('should fallback to github.com for invalid URLs', () => {
      expect(getGitHubBaseUrl('not-a-valid-url')).toBe('https://github.com');
    });

    it('should preserve protocol', () => {
      expect(getGitHubBaseUrl('http://github.internal.com/api/v3')).toBe('http://github.internal.com');
    });
  });
});
