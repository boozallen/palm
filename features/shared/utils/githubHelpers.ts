/**
 * Extracts the base GitHub URL from an API URL
 * @param apiBaseUrl - The API base URL (e.g., 'https://api.github.com' or 'https://github.example.com/api/v3')
 * @returns The base GitHub URL (e.g., 'https://github.com' or 'https://github.example.com')
 */
export function getGitHubBaseUrl(apiBaseUrl: string): string {
  try {
    const url = new URL(apiBaseUrl);

    // For GitHub.com: https://api.github.com -> https://github.com
    if (url.hostname === 'api.github.com') {
      return 'https://github.com';
    }

    // For GitHub Enterprise: remove /api/v3 or /api suffix from pathname
    // e.g., https://github.example.com/api/v3 -> https://github.example.com
    const baseUrl = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
    return baseUrl;
  } catch {
    // Fallback to github.com if URL parsing fails
    return 'https://github.com';
  }
}

/**
 * Returns a human-readable name for a GitHub instance derived from its API base URL.
 * For GitHub.com: 'GitHub.com'
 * For GitHub Enterprise: the hostname (e.g., 'github.example.com')
 */
export function getGitHubInstanceName(apiBaseUrl: string): string {
  try {
    const url = new URL(apiBaseUrl);
    if (url.hostname === 'api.github.com') {
      return 'GitHub.com';
    }
    return url.hostname;
  } catch {
    return 'GitHub';
  }
}

/**
 * Computes the GitHub Pages URL for a file in a repository.
 * For GitHub.com: https://<owner>.github.io/<repo>/<filePath>
 * For GitHub Enterprise: https://pages.<hostname>/<owner>/<repo>/<filePath>
 */
export function getGitHubPagesUrl(
  apiBaseUrl: string,
  owner: string,
  repo: string,
  filePath: string,
): string {
  try {
    const url = new URL(apiBaseUrl);

    if (url.hostname === 'api.github.com') {
      return `https://${owner}.github.io/${repo}/${filePath}`;
    }

    return `${url.protocol}//pages.${url.hostname}${url.port ? `:${url.port}` : ''}/${owner}/${repo}/${filePath}`;
  } catch {
    return `https://${owner}.github.io/${repo}/${filePath}`;
  }
}
