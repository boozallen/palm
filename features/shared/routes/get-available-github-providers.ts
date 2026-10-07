import { z } from 'zod';
import { procedure } from '@/server/trpc';
import getAvailableGitHubProviders from '@/features/shared/dal/getAvailableGitHubProviders';

const outputSchema = z.object({
  availableGitHubProviders: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      description: z.string(),
      apiBaseUrl: z.string(),
      owner: z.string(),
      repo: z.string(),
    })
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  const providers = await getAvailableGitHubProviders(ctx.userId);

  return {
    availableGitHubProviders: providers.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      apiBaseUrl: p.apiBaseUrl,
      owner: p.owner,
      repo: p.repo,
    })),
  };
});
