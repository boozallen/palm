import { getConfig } from '@/server/config';
import db from '@/server/db';
import logger from '@/server/logger';

const SERVICE_URL = getConfig().agentServices.repoServiceUrl;

export async function callRepoList(): Promise<unknown> {
  try {
    const providers = await db.gitHubProvider.findMany({
      where: { isSkillRepo: true, deletedAt: null },
      select: {
        id: true,
        label: true,
        owner: true,
        repo: true,
        description: true,
        skillRepoLastSyncAt: true,
      },
    });

    if (!providers.length) {
      return { repos: [], note: 'No skill repositories configured. An admin can add them in Settings > GitHub Providers.' };
    }

    const repos = await Promise.all(
      providers.map(async (p) => {
        try {
          const metaResponse = await fetch(`${SERVICE_URL}/repos/${p.id}/meta`, {
            signal: AbortSignal.timeout(5000),
          });
          const meta = metaResponse.ok ? await metaResponse.json() : null;

          return {
            repo_id: p.id,
            label: p.label,
            owner: p.owner,
            repo: p.repo,
            description: meta?.description || p.description,
            has_commands: meta?.has_commands || false,
            command_count: meta?.command_count || 0,
            commands: meta?.commands || [],
            synced: !!p.skillRepoLastSyncAt,
          };
        } catch {
          return {
            repo_id: p.id,
            label: p.label,
            owner: p.owner,
            repo: p.repo,
            description: p.description,
            has_commands: false,
            command_count: 0,
            synced: false,
          };
        }
      }),
    );

    return { repos };
  } catch (err) {
    logger.error('[SKILL-REPO-LIST-ERROR]', { error: (err as Error).message });
    return { error: `Failed to list repos: ${(err as Error).message}` };
  }
}
