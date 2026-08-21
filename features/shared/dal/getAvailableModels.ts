import { AvailableModel } from '@/features/shared/types/model';
import logger from '@/server/logger';
import db from '@/server/db';

export default async function getAvailableModels(
  userId: string,
): Promise<AvailableModel[]> {
  try {
    const results = await db.model.findMany({
      where: {
        deletedAt: null,
        // Embedding models can't serve chat completions, so they must never
        // appear in a model picker.
        embeddingsOnly: false,
        aiProvider: {
          userGroups: {
            some: {
              userGroupMemberships: {
                some: {
                  userId,
                },
              },
            },
          },
        },
      },
      include: {
        aiProvider: {
          select: {
            label: true,
            aiProviderTypeId: true,
          },
        },
      },
    });

    const availableModels: AvailableModel[] = [];

    for (const result of results) {
      availableModels.push({
        id: result.id,
        aiProviderId: result.aiProviderId,
        name: result.name,
        providerLabel: result.aiProvider.label,
        aiProviderTypeId: result.aiProvider.aiProviderTypeId,
        externalId: result.externalId,
        costPerInputToken: result.costPerInputToken,
        costPerOutputToken: result.costPerOutputToken,
      });
    }

    return availableModels;
  } catch (error) {
    // log error with details
    logger.error('Error fetching available models', error);
    // throw user-friendly error
    throw new Error('Error fetching available models');
  }
}
