import { getConfig } from '@/server/config';
import logger from '@/server/logger';

const SERVICE_URL = getConfig().agentServices.repoServiceUrl;

export async function callRepoSearch(args: Record<string, string>): Promise<unknown> {
  const repoId = args['repo_id'];
  const query = args['query'];
  if (!repoId) {
    return { error: 'repo_id is required' };
  }
  if (!query) {
    return { error: 'query is required' };
  }

  try {
    const response = await fetch(`${SERVICE_URL}/repos/${repoId}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_id: repoId, query, path: args['path'] || '' }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return { error: errorData.detail || `HTTP ${response.status}` };
    }

    return response.json();
  } catch (err) {
    logger.error('[SKILL-REPO-SEARCH-ERROR]', { repoId, query, error: (err as Error).message });
    return { error: `Failed to search: ${(err as Error).message}` };
  }
}
