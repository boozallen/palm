import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import getGitHubProvider from '@/features/settings/dal/github-providers/getGitHubProvider';

const inputSchema = z.object({
  id: z.string().uuid(),
});

const outputSchema = z.object({
  githubProvider: z.object({
    id: z.string().uuid(),
    label: z.string(),
    apiBaseUrl: z.string(),
    description: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }).nullable(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to view GitHub providers');
    }

    const provider = await getGitHubProvider(input.id);

    if (!provider) {
      return { githubProvider: null };
    }

    return {
      githubProvider: {
        id: provider.id,
        label: provider.label,
        apiBaseUrl: provider.apiBaseUrl,
        description: provider.description,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      },
    };
  });
