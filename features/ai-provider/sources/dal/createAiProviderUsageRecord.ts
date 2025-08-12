import db from '@/server/db';
import logger from '@/server/logger';

type CreateAiProviderUsageRecordInput = {
  userId: string;
  modelId: string;
  inputTokensUsed: number;
  outputTokensUsed: number;
  system: boolean;
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
