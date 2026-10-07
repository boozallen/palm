import { kbProviderConfigSchema, KbProviderConfig, KbProvider } from '@/features/shared/types';
import logger from '@/server/logger';
import db from '@/server/db';

/**
 * Gets all KB providers.
 */
export default async function getKbProviders(): Promise<KbProvider[]> {
  let results = null;

  try {
    results = await db.kbProvider.findMany({
      where: { deletedAt: null },
    });
  } catch (error) {
    logger.error('Error fetching knowledge base providers', error);
    throw new Error('Error fetching knowledge base providers');
  }

  const kbProviders: KbProvider[] = [];

  for (const result of results) {
    let kbProviderConfig: KbProviderConfig;
    try {
      // Validate type of the config from the DB
      kbProviderConfig = kbProviderConfigSchema.parse(result.config);
    } catch (error) {
      logger.error('Knowledge base provider config is invalid', error);
      throw new Error('Error fetching knowledge base providers');
    }

    kbProviders.push({
      id: result.id,
      kbProviderType: result.kbProviderType,
      label: result.label,
      config: kbProviderConfig,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  }

  return kbProviders;
}
