import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import deleteGitHubProvider from '@/features/settings/dal/github-providers/deleteGitHubProvider';

const inputSchema = z.object({
  id: z.string().uuid(),
});

const outputSchema = z.object({
  success: z.boolean(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to delete a GitHub provider');
    }

    await deleteGitHubProvider(input.id);

    return { success: true };
  });
