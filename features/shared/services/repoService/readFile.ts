import { getConfig } from '@/server/config';
import logger from '@/server/logger';

const SERVICE_URL = getConfig().agentServices.repoServiceUrl;

export async function callRepoReadFile(args: Record<string, string>): Promise<unknown> {
  const repoId = args['repo_id'];
  const path = args['path'];
  if (!repoId) {
    return { error: 'repo_id is required' };
  }
  if (!path) {
    return { error: 'path is required' };
  }

  try {
    const response = await fetch(`${SERVICE_URL}/repos/${repoId}/files/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_id: repoId, path }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return { error: errorData.detail || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { path: data.path, content: data.content };
  } catch (err) {
    logger.error('[SKILL-REPO-READ-ERROR]', { repoId, path, error: (err as Error).message });
    return { error: `Failed to read file: ${(err as Error).message}` };
  }
}
