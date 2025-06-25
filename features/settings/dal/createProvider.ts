import { Provider, AiProviderType, ProviderConfig } from '@/features/shared/types';
import db from '@/server/db';
import { createProviderConfigWithDB } from '@/features/settings/dal/createProviderConfig';
import logger from '@/server/logger';

type CreateProviderInput = {
  label: string;
  type: AiProviderType;
  config: Exclude<ProviderConfig, 'id'>;
  costPerInputToken?: number;
  costPerOutputToken?: number;
};

export default async function createProvider(input: CreateProviderInput): Promise<Provider> {
  try {
    return db.$transaction(async (tx) => {
      const providerConfig = await createProviderConfigWithDB(tx, input.config);
      const provider = await tx.aiProvider.create({
        data: {
          label: input.label,
          aiProviderTypeId: input.type,
          apiConfigType: input.config.type,
          apiConfigId: providerConfig.id,
          costPerInputToken: input.costPerInputToken,
          costPerOutputToken: input.costPerOutputToken,
        },
      });

      return {
        id: provider.id,
        typeId: provider.aiProviderTypeId,
        label: provider.label,
        configTypeId: providerConfig.type,
        config: providerConfig,
        costPerInputToken: provider.costPerInputToken,
        costPerOutputToken: provider.costPerOutputToken,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      };
    });
  } catch (error) {
    logger.error('Error creating provider', error);
    throw new Error('Error creating provider');
  }
}
