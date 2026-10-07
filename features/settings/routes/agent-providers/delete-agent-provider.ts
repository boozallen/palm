import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import deleteAgentProvider from '@/features/settings/dal/agent-providers/deleteAgentProvider';
import getAgentProvider from '@/features/settings/dal/agent-providers/getAgentProvider';
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
      throw Unauthorized('You do not have permission to delete an agent provider');
    }

    const provider = await getAgentProvider(input.id);
    await deleteAgentProvider(input.id);

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.DeleteAgentProvider,
      description: `Agent provider "${provider.name}" was deleted`,
    });

    return { success: true };
  });
