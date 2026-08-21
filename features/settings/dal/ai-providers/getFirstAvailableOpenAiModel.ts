import db from '@/server/db';
import logger from '@/server/logger';
import { Model } from '@/features/shared/types/model';

export default async function getFirstAvailableOpenAiModel(): Promise<Model | null> {
  let result;
  try {
    result = await db.model.findFirst({
      where: {
        deletedAt: null,
        aiProvider: {
          aiProviderTypeId: 1,
          deletedAt: null,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching OpenAI model', error);
    return null;
  }

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    aiProviderId: result.aiProviderId,
    name: result.name,
    externalId: result.externalId,
    costPerInputToken: result.costPerInputToken,
    costPerOutputToken: result.costPerOutputToken,
  };
}
