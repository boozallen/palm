import { getConfig } from '@/server/config';
import logger from '@/server/logger';
import db from '@/server/db';

type SyncState = {
  syncing: boolean;
  timer: NodeJS.Timeout | null;
};

const g = globalThis as typeof globalThis & { __repoSync?: SyncState };
if (!g.__repoSync) {
  g.__repoSync = { syncing: false, timer: null };
}
const state = g.__repoSync;

const SERVICE_URL = getConfig().agentServices.repoServiceUrl;

export function isSyncing(): boolean {
  return state.syncing;
}

export async function waitForReady(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (state.syncing && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return !state.syncing;
}

function buildRepoUrl(provider: { apiBaseUrl: string; owner: string; repo: string }): string {
  const apiBase = provider.apiBaseUrl.replace('/api/v3', '').replace('/api/v4', '');
  return `${apiBase}/${provider.owner}/${provider.repo}`;
}

async function refreshAllRepos(): Promise<void> {
  if (state.syncing) { return; }
  state.syncing = true;
  try {
    const providers = await db.gitHubProvider.findMany({
      where: { isSkillRepo: true, deletedAt: null },
    });

    if (providers.length === 0) {
      logger.debug('[repo-service] no skill repos configured');
      return;
    }

    for (const provider of providers) {
      try {
        const repoUrl = buildRepoUrl(provider);
        const branch = provider.skillRepoBranch || 'main';

        const response = await fetch(`${SERVICE_URL}/repos/${provider.id}/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo_url: repoUrl,
            access_token: provider.accessToken,
            branch,
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          logger.error('[repo-service] refresh failed for provider', {
            providerId: provider.id,
            error: errorData,
          });
          continue;
        }

        const data = await response.json();

        await db.gitHubProvider.update({
          where: { id: provider.id },
          data: {
            skillRepoLastSyncAt: new Date(),
            skillRepoLastSyncCommit: data.commit || null,
          },
        });

        logger.info('[repo-service] sync ok', {
          providerId: provider.id,
          commit: (data.commit || '').substring(0, 7),
        });
      } catch (err) {
        logger.error('[repo-service] sync failed for provider', {
          providerId: provider.id,
          err,
        });
      }
    }
  } finally {
    state.syncing = false;
  }
}

export async function ensureRepoReady(): Promise<void> {
  await refreshAllRepos();
}

export function startPeriodicSync(opts?: {
  repoUrl?: string;
  token?: string;
  branch?: string;
  intervalMinutes?: number;
}): void {
  if (state.timer) { return; }

  const intervalMinutes = opts?.intervalMinutes || 15;

  void refreshAllRepos();

  state.timer = setInterval(() => {
    void refreshAllRepos();
  }, intervalMinutes * 60_000);
  logger.info('[repo-service] periodic sync started', { intervalMinutes });
}

export function __resetForTests(): void {
  state.syncing = false;
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}
