import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import refreshSkillRepo from '@/features/settings/dal/github-providers/refreshSkillRepo';

const inputSchema = z.object({
  githubProviderId: z.string().uuid('Invalid GitHub provider ID'),
});

const outputSchema = z.object({
  success: z.boolean(),
  commit: z.string().optional(),
  timestamp: z.string().optional(),
  error: z.string().optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to refresh skill repo');
    }

    const result = await refreshSkillRepo(input.githubProviderId);

    return result;
  });
