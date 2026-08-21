import logger from '@/server/logger';
import db from '@/server/db';
import { AvailableModel, Model } from '@/features/shared/types/model';

type UpdateAiProviderModelInput = Omit<Model, 'aiProviderId' | 'embeddingsOnly'>;

export default async function updateAiProviderModel(
  input: UpdateAiProviderModelInput,
): Promise<AvailableModel> {
  try {
    // embeddingsOnly is deliberately absent from the update payload: this form
    // edits a model's identity and rates, while the designation is fixed when the
    // model is added, where addAiProviderModel enforces the one-per-provider rule
    // transactionally. Writing it here would let an edit clear it silently.
    const updatedModel = await db.model.update({
      where: {
        id: input.id,
        deletedAt: null,
      },
      data: {
        name: input.name,
        externalId: input.externalId,
        costPerInputToken: input.costPerInputToken,
        costPerOutputToken: input.costPerOutputToken,
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

    return {
      id: updatedModel.id,
      name: updatedModel.name,
      externalId: updatedModel.externalId,
      costPerInputToken: updatedModel.costPerInputToken,
      costPerOutputToken: updatedModel.costPerOutputToken,
      embeddingsOnly: updatedModel.embeddingsOnly,
      aiProviderId: updatedModel.aiProviderId,
      providerLabel: updatedModel.aiProvider.label,
      aiProviderTypeId: updatedModel.aiProvider.aiProviderTypeId,
    };
  } catch (error) {
    logger.error('Error updating AI provider model', error);
    throw new Error('Error updating AI provider model');
  }
}
