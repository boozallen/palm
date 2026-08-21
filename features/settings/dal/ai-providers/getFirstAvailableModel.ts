import db from '@/server/db';
import logger from '@/server/logger';
import { Model } from '@/features/shared/types/model';

export default async function getFirstAvailableModel(): Promise<Model | null> {
  let result;
  try {
    result = await db.model.findFirst({
      where: {
        deletedAt: null,
        // Callers want a model that can serve completions; embedding models can't.
        embeddingsOnly: false,
        aiProvider: {
          deletedAt: null,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching available model', error);
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
