import { getConfig } from '@/server/config';
import logger from '@/server/logger';

const SERVICE_URL = getConfig().agentServices.repoServiceUrl;

export async function callRepoListFiles(args: Record<string, string>): Promise<unknown> {
  const repoId = args['repo_id'];
  if (!repoId) {
    return { error: 'repo_id is required' };
  }

  const path = args['path'] || '';

  try {
    const url = path
      ? `${SERVICE_URL}/repos/${repoId}/files?path=${encodeURIComponent(path)}`
      : `${SERVICE_URL}/repos/${repoId}/files`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return { error: errorData.detail || `HTTP ${response.status}` };
    }

    return response.json();
  } catch (err) {
    logger.error('[SKILL-REPO-LIST-FILES-ERROR]', { repoId, path, error: (err as Error).message });
    return { error: `Failed to list files: ${(err as Error).message}` };
  }
}
