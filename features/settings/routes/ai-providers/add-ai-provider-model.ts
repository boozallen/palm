import { z } from 'zod';
import { procedure } from '@/server/trpc';
import addAiProviderModel from '@/features/settings/dal/ai-providers/addAiProviderModel';
import updateSystemConfigDefaultModel from '@/features/settings/dal/system-configurations/updateSystemConfigDefaultModel';
import updateSystemConfigFastModel from '@/features/settings/dal/system-configurations/updateSystemConfigFastModel';
import updateSystemConfigKnowledgeGraphModel from '@/features/settings/dal/system-configurations/updateSystemConfigKnowledgeGraphModel';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';
import { TOKEN_COST_RATE } from '@/features/shared/utils';
import { DuplicateEmbeddingsModelError } from '@/features/shared/errors/duplicateEmbeddingsModelError';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  name: z.string(),
  externalId: z.string(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  aiProviderId: z.string().uuid(),
  embeddingsOnly: z.boolean().optional(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  externalId: z.string(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  aiProviderId: z.string().uuid(),
  providerLabel: z.string(),
  embeddingsOnly: z.boolean(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to add a new model',
      });
    }

    let result;
    try {
      result = await addAiProviderModel({
        name: input.name,
        externalId: input.externalId,
        costPerInputToken: input.costPerMillionInputTokens / TOKEN_COST_RATE,
        costPerOutputToken: input.costPerMillionOutputTokens / TOKEN_COST_RATE,
        aiProviderId: input.aiProviderId,
        embeddingsOnly: input.embeddingsOnly,
      });
    } catch (error) {
      // The error class cannot cross the wire, so the one-per-provider rejection
      // is translated into a code the client can key on. Its message names the
      // model already designated, which is what tells the admin what to fix.
      if (error instanceof DuplicateEmbeddingsModelError) {
        throw new TRPCError({ code: 'CONFLICT', message: error.message });
      }

      throw error;
    }

    // An embedding model can't serve these completions, so it must not become
    // the default when it happens to be the first model added.
    if (!result.embeddingsOnly) {
      await updateSystemConfigDefaultModel(result.id);
      await updateSystemConfigFastModel(result.id);
      await updateSystemConfigKnowledgeGraphModel(result.id);
    }

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.ConfigureAiProvider,
      description: `Model "${result.name}" was added to AI provider "${result.providerLabel}"`,
    });

    const output: z.infer<typeof outputSchema> = {
      id: result.id,
      name: result.name,
      externalId: result.externalId,
      costPerMillionInputTokens: result.costPerInputToken * TOKEN_COST_RATE,
      costPerMillionOutputTokens: result.costPerOutputToken * TOKEN_COST_RATE,
      aiProviderId: result.aiProviderId,
      providerLabel: result.providerLabel,
      embeddingsOnly: result.embeddingsOnly ?? false,
    };

    return output;
  });
