import buildProvider from '@/features/shared/dal/buildProvider';
import { Provider } from '@/features/shared/types';
import logger from '@/server/logger';
import db from '@/server/db';

/**
 * Gets a specific provider by id.
 * @param {string} id
 */
export default async function getAiProvider(id: string): Promise<Provider> {
  let result = null;

  try {
    result = await db.aiProvider.findUnique({
      where: { id, deletedAt: null },
    });
  } catch (error) {
    logger.error('Error fetching AI provider', error);
    throw new Error('Error fetching AI provider');
  }

  if (!result) {
    logger.warn('Provider not found');
    throw new Error('Provider not found');
  }

  return await buildProvider(db, result);
}
