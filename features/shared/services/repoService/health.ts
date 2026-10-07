import { getConfig } from '@/server/config';
import logger from '@/server/logger';

const SERVICE_URL = getConfig().agentServices.repoServiceUrl;

type HealthResponse = {
  status: string;
  repos: Array<{
    id: string;
    commands_available: boolean;
    command_count: number;
  }>;
  repo_count: number;
};

export async function checkHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${SERVICE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.error('[repo-service] Health check failed', { status: response.status });
      return null;
    }

    const data: HealthResponse = await response.json();
    return data;
  } catch (err) {
    logger.error('[repo-service] Health check request failed', { err });
    return null;
  }
}
