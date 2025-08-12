import logger from '@/server/logger';
import db from '@/server/db';
import { AvailableModel } from '@/features/shared/types/model';

type AddAiProviderModelInput = Omit<AvailableModel, 'id' | 'providerLabel'>;

export default async function addAiProviderModel(
  input: AddAiProviderModelInput,
): Promise<AvailableModel> {
  try {
    const result = await db.model.create({
      data: {
        name: input.name,
        externalId: input.externalId,
        costPerInputToken: input.costPerInputToken,
        costPerOutputToken: input.costPerOutputToken,
        aiProviderId: input.aiProviderId,
      },
      include: {
        aiProvider: {
          select: {
            label: true,
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
      aiProviderId: result.aiProviderId,
      providerLabel: result.aiProvider.label,
    };
  } catch (error) {
    logger.error('Error creating AI provider model', error);
    throw new Error('Error creating AI provider model');
  }
}
