import { getConfig } from '@/server/config';
import logger from '@/server/logger';

const SERVICE_URL = getConfig().agentServices.repoServiceUrl;

type LoadCommandResponse = {
  command: string;
  instructions: string;
  sources: Array<{
    path: string;
    content?: string;
    error?: string;
  }>;
  user_input: string;
};

export async function callRepoRunCommand(args: Record<string, string>): Promise<unknown> {
  const repoId = args['repo_id'];
  const command = args['command'];
  if (!repoId) {
    return { error: 'repo_id is required' };
  }
  if (!command) {
    return { error: 'command is required' };
  }

  logger.info('[SKILL-REPO-RUN-COMMAND]', { repoId, command, hasUserInput: !!args['user_input'] });

  try {
    const response = await fetch(`${SERVICE_URL}/repos/${repoId}/commands/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo_id: repoId,
        command,
        user_input: args['user_input'] || '',
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      logger.error('[SKILL-REPO-RUN-COMMAND-FAILED]', { repoId, command, error: errorData });
      return { error: errorData.detail || `HTTP ${response.status}` };
    }

    const data: LoadCommandResponse = await response.json();

    const sourcesText = data.sources
      .map((s) => {
        if (s.error) {
          return `### ${s.path}\n[Error: ${s.error}]`;
        }
        return `### ${s.path}\n${s.content}`;
      })
      .join('\n\n---\n\n');

    return {
      instructions: `You are executing the /${data.command} command.\n\n` +
        `## Command Instructions\n\n${data.instructions}` +
        (data.user_input ? `\n\n## User Request\n\n${data.user_input}` : ''),
      sources: sourcesText || '(No pre-bundled sources — use skill_repo_read_file to gather files referenced in the instructions.)',
      note: 'Follow the command instructions above. ' +
        'If you need additional files, use skill_repo_read_file or skill_repo_search.',
    };
  } catch (err) {
    logger.error('[SKILL-REPO-RUN-COMMAND-ERROR]', { repoId, command, error: (err as Error).message });
    return { error: `Failed to load command: ${(err as Error).message}` };
  }
}
