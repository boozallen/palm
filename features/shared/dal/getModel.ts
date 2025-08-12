import { Model } from '../types/model';
import db from '@/server/db';
import logger from '@/server/logger';

export default async function getModel(modelId: string): Promise<Model> {
  let result = null;
  try {
    result = await db.model.findUnique({
      where: { id: modelId, deletedAt: null },
    });
  } catch (error) {
    logger.error('Error fetching model', error);
    throw new Error('Error fetching model');
  }

  if (!result) {
    logger.warn('Model not found');
    throw new Error('Model not found');
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
