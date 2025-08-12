import { KbProvider, kbProviderConfigSchema, KbProviderForm } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

export default async function createKbProvider(
  input: KbProviderForm
): Promise<KbProvider> {
  try {
    const result = await db.kbProvider.create({
      data: {
        label: input.label,
        kbProviderType: input.kbProviderType,
        config: input.config,
      },
    });

    return {
      id: result.id,
      label: result.label,
      kbProviderType: result.kbProviderType,
      config: kbProviderConfigSchema.parse(result.config),
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  } catch (error) {
    logger.error('Error creating knowledge base provider', error);
    throw new Error('Error creating knowledge base provider');
  }
}
