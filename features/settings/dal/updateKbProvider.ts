import logger from '@/server/logger';
import db from '@/server/db';
import {
  KbProvider,
  KbProviderConfig,
  kbProviderConfigSchema,
} from '@/features/shared/types';
import mergeKbProviderConfig from '@/features/kb-provider/sources/utils';

type UpdateKbProviderInput = {
  id: string;
  label: string;
  writeAccess: boolean;
  config: KbProviderConfig;
};

export default async function updateKbProvider(
  input: UpdateKbProviderInput
): Promise<KbProvider> {
  try {
    return await db.$transaction(async (tx): Promise<KbProvider> => {
      const existingProvider = await tx.kbProvider.findUnique({
        where: { id: input.id, deletedAt: null },
      });

      if (!existingProvider) {
        logger.warn(`KB Provider could not be found: ${input.id}`);
        throw new Error('KB Provider could not be found.');
      }

      const existingConfig = kbProviderConfigSchema.parse(existingProvider.config);

      const mergedConfig = mergeKbProviderConfig(existingConfig, input.config, existingProvider.kbProviderType);

      const config = kbProviderConfigSchema.parse(mergedConfig);

      const updatedProvider = await tx.kbProvider.update({
        where: { id: input.id, deletedAt: null },
        data: {
          label: input.label,
          writeAccess: input.writeAccess,
          config: config,
        },
      });

      return {
        id: updatedProvider.id,
        kbProviderType: updatedProvider.kbProviderType,
        label: updatedProvider.label,
        writeAccess: updatedProvider.writeAccess,
        config: kbProviderConfigSchema.parse(updatedProvider.config),
        createdAt: updatedProvider.createdAt,
        updatedAt: updatedProvider.updatedAt,
      };
    });
  } catch (error) {
    logger.error('Error updating KB Provider:', error);
    throw new Error('Failed to update KB Provider. Please try again later.');
  }
}
