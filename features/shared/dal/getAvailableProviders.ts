import { AvailableProvider } from '@/features/shared/types';
import logger from '@/server/logger';
import db from '@/server/db';

/**
 * Gets all available providers for a user. 
 * 
 */
export default async function getAvailableProviders(): Promise<AvailableProvider[]> {
  let results = null;

  try {
    results = await db.aiProvider.findMany({
      where: {
        deletedAt: null,
      },
    });

    const availableProviders: AvailableProvider[] = [];

    for (const result of results) {
      // there will not be any need to add a call to buildProvider here; we will not need the config
      availableProviders.push({
        id: result.id,
        typeId: result.aiProviderTypeId,
        label: result.label,
        costPerInputToken: result.costPerInputToken,
        costPerOutputToken: result.costPerOutputToken,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      });
    }

    return availableProviders;
  } catch (error) {
    // log error with details
    logger.error('Error fetching available AI providers', error);
    // throw user-friendly error
    throw new Error('Error fetching available AI providers');
  }
}
