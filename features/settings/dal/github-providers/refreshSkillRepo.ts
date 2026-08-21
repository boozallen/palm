import db from '@/server/db';
import logger from '@/server/logger';

type RefreshResult = {
  success: boolean;
  commit?: string;
  timestamp?: string;
  error?: string;
};

export default async function refreshSkillRepo(githubProviderId: string): Promise<RefreshResult> {
  const provider = await db.gitHubProvider.findUnique({
    where: { id: githubProviderId, deletedAt: null },
  });

  if (!provider) {
    return { success: false, error: 'GitHub provider not found' };
  }

  if (!provider.isSkillRepo) {
    return { success: false, error: 'This provider is not configured as a skill repo' };
  }

  const serviceUrl = provider.skillRepoServiceUrl || 'http://repo-service:8002';

  // Build the full repository URL from the provider configuration
  // apiBaseUrl is like "https://github.example.com/api/v3"
  // We need to construct "https://github.example.com/owner/repo"
  const apiBase = provider.apiBaseUrl.replace('/api/v3', '');
  const repoUrl = `${apiBase}/${provider.owner}/${provider.repo}`;
  const branch = provider.skillRepoBranch || 'main';

  try {
    const response = await fetch(`${serviceUrl}/repos/${githubProviderId}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo_url: repoUrl,
        access_token: provider.accessToken,
        branch: branch,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      logger.error('[refresh-skill-repo] Service returned error', {
        status: response.status,
        error: errorData,
      });
      return { success: false, error: errorData.detail || `HTTP ${response.status}` };
    }

    const data = await response.json();

    // Update the sync timestamp in the database
    await db.gitHubProvider.update({
      where: { id: githubProviderId },
      data: {
        skillRepoLastSyncAt: new Date(),
        skillRepoLastSyncCommit: data.commit || null,
      },
    });

    logger.info('[refresh-skill-repo] Successfully refreshed', {
      providerId: githubProviderId,
      commit: data.commit,
    });

    return {
      success: true,
      commit: data.commit,
      timestamp: data.timestamp,
    };
  } catch (err) {
    logger.error('[refresh-skill-repo] Request failed', { githubProviderId, err });
    return {
      success: false,
      error: `Failed to refresh: ${(err as Error).message}`,
    };
  }
}
