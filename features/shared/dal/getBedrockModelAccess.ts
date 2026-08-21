import db from '@/server/db';
import logger from '@/server/logger';
import { AiProviderType } from '@/features/shared/types';

export default async function getBedrockModelAccess(
  userId: string,
): Promise<boolean> {
  try {
    const result = await db.model.findFirst({
      where: {
        deletedAt: null,
        // A group whose only Bedrock model is the embedding model has no Bedrock
        // model it can actually chat with, so it does not count as access.
        embeddingsOnly: false,
        aiProvider: {
          aiProviderTypeId: AiProviderType.Bedrock,
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

    return !!result;
  } catch (error) {
    logger.error('Error checking Bedrock model access', error);
    throw new Error('Error checking Bedrock model access');
  }
}