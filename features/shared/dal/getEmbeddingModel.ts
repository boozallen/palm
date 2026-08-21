import db from '@/server/db';
import logger from '@/server/logger';
import { Model } from '@/features/shared/types/model';

/**
 * Resolves the embedding model a given user's embeddings run on.
 *
 * Matched on the embeddingsOnly flag rather than a hardcoded externalId: an admin
 * designates one model per provider as embeddings-only from the provider table,
 * and BedrockSource.createEmbeddings now invokes whatever externalId it is handed.
 * The flag is therefore the only thing that says which model embeddings use.
 *
 * Scoped to the user's groups, mirroring getAvailableModels, so a user only ever
 * embeds against a provider their group has been granted. A user in groups that
 * span several providers has more than one candidate; the oldest provider wins so
 * the choice is stable across calls and matches getFirstAvailableModel's ordering.
 */
export default async function getEmbeddingModel(
  userId: string,
): Promise<Model | null> {
  let result;
  try {
    result = await db.model.findFirst({
      where: {
        deletedAt: null,
        embeddingsOnly: true,
        aiProvider: {
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
      orderBy: [{ aiProvider: { createdAt: 'asc' } }, { id: 'asc' }],
    });
  } catch (error) {
    logger.error('Error fetching embedding model', error);
    return null;
  }

  if (!result) {
    logger.error('No embedding model is available to this user');
    return null;
  }

  return {
    id: result.id,
    aiProviderId: result.aiProviderId,
    name: result.name,
    externalId: result.externalId,
    costPerInputToken: result.costPerInputToken,
    costPerOutputToken: result.costPerOutputToken,
    embeddingsOnly: result.embeddingsOnly,
  };
}
