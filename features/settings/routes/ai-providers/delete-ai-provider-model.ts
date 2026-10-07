import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';
import deleteAiProviderModel from '@/features/settings/dal/ai-providers/deleteAiProviderModel';
import updateSystemConfigDefaultModel from '@/features/settings/dal/system-configurations/updateSystemConfigDefaultModel';
import updateSystemConfigFastModel from '@/features/settings/dal/system-configurations/updateSystemConfigFastModel';
import updateSystemConfigKnowledgeGraphModel from '@/features/settings/dal/system-configurations/updateSystemConfigKnowledgeGraphModel';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  modelId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { modelId } = input;

    if (ctx.userRole !== UserRole.Admin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
    }

    const deletedModel = await deleteAiProviderModel(modelId);

    await updateSystemConfigDefaultModel();
    await updateSystemConfigFastModel();
    await updateSystemConfigKnowledgeGraphModel();

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.DeleteAiProvider,
      description: `AI provider model ${deletedModel.id} was deleted`,
    });

    return {
      id: deletedModel.id,
    };
  });
