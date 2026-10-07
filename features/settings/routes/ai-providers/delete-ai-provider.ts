import { z } from 'zod';
import { procedure } from '@/server/trpc';
import deleteAiProvider from '@/features/settings/dal/ai-providers/deleteAiProvider';
import getAiProvider from '@/features/settings/dal/ai-providers/getAiProvider';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';
import updateSystemConfigDefaultModel from '@/features/settings/dal/system-configurations/updateSystemConfigDefaultModel';
import updateSystemConfigFastModel from '@/features/settings/dal/system-configurations/updateSystemConfigFastModel';
import updateSystemConfigKnowledgeGraphModel from '@/features/settings/dal/system-configurations/updateSystemConfigKnowledgeGraphModel';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  providerId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { providerId } = input;

    if (ctx.userRole !== UserRole.Admin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
    }

    const provider = await getAiProvider(providerId);
    const result = await deleteAiProvider(providerId);
    await updateSystemConfigDefaultModel();
    await updateSystemConfigFastModel();
    await updateSystemConfigKnowledgeGraphModel();

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.DeleteAiProvider,
      description: `AI provider "${provider.label}" was deleted`,
    });

    return result;
  });

