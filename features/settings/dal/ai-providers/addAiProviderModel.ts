import logger from '@/server/logger';
import db from '@/server/db';
import { AvailableModel, Model } from '@/features/shared/types/model';
import { DuplicateEmbeddingsModelError } from '@/features/shared/errors/duplicateEmbeddingsModelError';

type AddAiProviderModelInput = Omit<Model, 'id'>;

export default async function addAiProviderModel(
  input: AddAiProviderModelInput,
): Promise<AvailableModel> {
  const embeddingsOnly = input.embeddingsOnly ?? false;

  try {
    // A provider may have at most one embeddings-only model: getEmbeddingModel
    // picks a single row per provider, so a second would silently never be used.
    // There is no unique constraint on the column — a partial unique index would
    // have to be scoped to `deletedAt IS NULL` — so the check shares a transaction
    // with the insert, which stops two concurrent adds from both passing it.
    return await db.$transaction(async (tx) => {
      if (embeddingsOnly) {
        const existing = await tx.model.findFirst({
          where: {
            deletedAt: null,
            embeddingsOnly: true,
            aiProviderId: input.aiProviderId,
          },
          select: { name: true },
        });

        if (existing) {
          logger.warn('Provider already has an embeddings-only model');
          throw new DuplicateEmbeddingsModelError(existing.name);
        }
      }

      const result = await tx.model.create({
        data: {
          name: input.name,
          externalId: input.externalId,
          costPerInputToken: input.costPerInputToken,
          costPerOutputToken: input.costPerOutputToken,
          aiProviderId: input.aiProviderId,
          embeddingsOnly,
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
      logger.debug('db.model.create', { result });

      return {
        id: result.id,
        name: result.name,
        externalId: result.externalId,
        costPerInputToken: result.costPerInputToken,
        costPerOutputToken: result.costPerOutputToken,
        embeddingsOnly: result.embeddingsOnly,
        aiProviderId: result.aiProviderId,
        providerLabel: result.aiProvider.label,
        aiProviderTypeId: result.aiProvider.aiProviderTypeId,
      };
    });
  } catch (error) {
    logger.error('Error creating AI provider model', error);

    // The uniqueness rejection tells the admin which model to delete first, so it
    // propagates for the route to translate; every other failure is a DB error
    // and gets sanitized.
    if (error instanceof DuplicateEmbeddingsModelError) {
      throw error;
    }

    throw new Error('Error creating AI provider model');
  }
}
