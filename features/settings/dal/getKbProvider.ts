import { kbProviderConfigSchema, KbProviderConfig, KbProvider } from '@/features/shared/types';
import logger from '@/server/logger';
import db from '@/server/db';

/**
 * Gets a specific KB provider by id.
 * @param {string} id
 */
export default async function getKbProvider(id: string): Promise<KbProvider> {
  let result = null;

  try {
    result = await db.kbProvider.findUnique({
      where: { id, deletedAt: null },
    });
  } catch (error) {
    logger.error('Error fetching knowledge base provider', error);
    throw new Error('Error fetching knowledge base provider');
  }

  if (!result) {
    logger.warn('Knowledge base provider not found');
    throw new Error('Knowledge base provider not found');
  }

  let kbProviderConfig: KbProviderConfig;
  try {
    // Validate type of the config from the DB
    kbProviderConfig = kbProviderConfigSchema.parse(result.config);
  } catch (error) {
    logger.error('Knowledge base provider config is invalid', error);
    throw new Error('Error fetching knowledge base provider');
  }

  return {
    id: result.id,
    kbProviderType: result.kbProviderType,
    writeAccess: result.writeAccess,
    label: result.label,
    config: kbProviderConfig,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}
