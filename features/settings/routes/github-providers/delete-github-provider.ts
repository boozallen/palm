import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import getGitHubProvider from '@/features/settings/dal/github-providers/getGitHubProvider';
import deleteGitHubProvider from '@/features/settings/dal/github-providers/deleteGitHubProvider';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

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

    const provider = await getGitHubProvider(input.id);

    await deleteGitHubProvider(input.id);

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.DeleteGithubProvider,
      description: `GitHub provider "${provider?.label ?? input.id}" was deleted`,
    });

    return { success: true };
  });
