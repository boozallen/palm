import db from '@/server/db';
import logger from '@/server/logger';

type CreateAiProviderUsageRecordInput = {
  userId: string;
  modelId: string;
  inputTokensUsed: number;
  outputTokensUsed: number;
  system: boolean;
  agent?: boolean;
  knowledgeGraph?: boolean;
  embedding?: boolean;
  chatMessageId?: string;
  workflowExecutionId?: string;
  primitiveId?: string;
  documentId?: string;
  stepLabel?: string;
};

type AiProviderUsageRecord = {
  id: string;
  timestamp: Date;
  userId: string;
  aiProviderId: string;
  modelId: string;
  inputTokensUsed: number;
  costPerInputToken: number;
  outputTokensUsed: number;
  costPerOutputToken: number;
  system: boolean;
  agent: boolean;
  knowledgeGraph: boolean;
  embedding: boolean;
  chatMessageId: string | null;
  workflowExecutionId: string | null;
  primitiveId: string | null;
  documentId: string | null;
  stepLabel: string | null;
};

export default async function createAiProviderUsageRecord(
  input: CreateAiProviderUsageRecordInput,
): Promise<AiProviderUsageRecord> {

  return await db.$transaction(async (tx) => {
    try {
      const model = await tx.model.findUnique({
        // Do not include soft-delete check, since we want this information even if the model has been deleted
        where: { id: input.modelId },
        select: {
          aiProviderId: true,
          costPerInputToken: true,
          costPerOutputToken: true,
          aiProvider: {
            select: {
              costPerInputToken: true,
              costPerOutputToken: true,
            },
          },
        },
      });
      if (!model) {
        throw new Error('Could not find model');
      }

      const costPerInputToken =
        model.costPerInputToken !== 0
          ? model.costPerInputToken
          : model.aiProvider.costPerInputToken;
      const costPerOutputToken =
        model.costPerOutputToken !== 0
          ? model.costPerOutputToken
          : model.aiProvider.costPerOutputToken;

      const result = await tx.aiProviderUsage.create({
        data: {
          userId: input.userId,
          aiProviderId: model.aiProviderId,
          modelId: input.modelId,
          inputTokensUsed: input.inputTokensUsed,
          costPerInputToken,
          outputTokensUsed: input.outputTokensUsed,
          costPerOutputToken,
          system: input.system,
          agent: input.agent ?? false,
          knowledgeGraph: input.knowledgeGraph ?? false,
          embedding: input.embedding ?? false,
          ...(input.chatMessageId ? { chatMessageId: input.chatMessageId } : {}),
          ...(input.workflowExecutionId ? { workflowExecutionId: input.workflowExecutionId } : {}),
          ...(input.primitiveId ? { primitiveId: input.primitiveId } : {}),
          ...(input.documentId ? { documentId: input.documentId } : {}),
          ...(input.stepLabel ? { stepLabel: input.stepLabel } : {}),
        },
      });

      return {
        id: result.id,
        timestamp: result.timestamp,
        userId: result.userId,
        aiProviderId: result.aiProviderId,
        modelId: result.modelId,
        inputTokensUsed: result.inputTokensUsed,
        costPerInputToken: result.costPerInputToken,
        outputTokensUsed: result.outputTokensUsed,
        costPerOutputToken: result.costPerOutputToken,
        system: result.system,
        agent: result.agent,
        knowledgeGraph: result.knowledgeGraph,
        embedding: result.embedding,
        chatMessageId: result.chatMessageId,
        workflowExecutionId: result.workflowExecutionId,
        primitiveId: result.primitiveId,
        documentId: result.documentId,
        stepLabel: result.stepLabel,
      };
    } catch (error) {
      logger.error(
        'There was an error creating record for AI provider usage',
        error,
      );
      throw new Error(
        'There was an error creating record for AI provider usage',
      );
    }
  });
}
