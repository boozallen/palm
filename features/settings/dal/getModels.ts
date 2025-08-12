import { AvailableModel } from '@/features/shared/types/model';
import logger from '@/server/logger';
import db from '@/server/db';

export async function getModels(): Promise<AvailableModel[]> {
  let results = null;
  try {
    results = await db.model.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        aiProvider: {
          select: {
            label: true,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching AI provider models', error);
    throw new Error('Error fetching AI provider models');
  }

  return results.map(
    (model): AvailableModel => ({
      id: model.id,
      aiProviderId: model.aiProviderId,
      providerLabel: model.aiProvider.label,
      name: model.name,
      externalId: model.externalId,
      costPerInputToken: model.costPerInputToken,
      costPerOutputToken: model.costPerOutputToken,
    }),
  );
}
