import { getConfig } from '@/server/config';
import logger from '@/server/logger';

const SERVICE_URL = getConfig().agentServices.repoServiceUrl;

export async function callRepoListCommands(args: Record<string, string>): Promise<unknown> {
  const repoId = args['repo_id'];
  if (!repoId) {
    return { error: 'repo_id is required' };
  }

  try {
    const response = await fetch(`${SERVICE_URL}/repos/${repoId}/commands`, {
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
    logger.error('[SKILL-REPO-LIST-COMMANDS-ERROR]', { repoId, error: (err as Error).message });
    return { error: `Failed to list commands: ${(err as Error).message}` };
  }
}
