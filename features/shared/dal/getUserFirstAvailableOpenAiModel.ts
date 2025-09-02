import db from '@/server/db';
import logger from '@/server/logger';
import { Model } from '@/features/shared/types/model';

export default async function getUserFirstAvailableOpenAiModel(
  userId: string,
): Promise<Model | null> {
  try {
    const result = await db.model.findFirst({
      where: {
        deletedAt: null,
        aiProvider: {
          aiProviderTypeId: 1,
          deletedAt: null,
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
    });

    if (!result) {
      logger.warn(`No available OpenAI model found for user ${userId}`);
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
  } catch (error) {
    logger.error(`Error fetching OpenAI model for user ${userId}`, error);
    throw new Error('Error fetching OpenAI model');
  }
}
