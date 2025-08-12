import { Provider } from '@/features/shared/types';
import logger from '@/server/logger';
import db from '@/server/db';
import buildProvider from '@/features/shared/dal/buildProvider';

/**
 * Gets all providers. 
 */
export default async function getAiProviders(): Promise<Provider[]> {
  let results = null;

  try {
    results = await db.aiProvider.findMany({
      where: {
        deletedAt: null,
      },
    });

    const providers: Provider[] = [];

    for (const result of results) {
      providers.push(await buildProvider(db, result));
    }

    return providers;
  } catch (error) {
    logger.error('Error fetching AI providers', error);
    // throw user-friendly error
    throw new Error('Error fetching AI providers');
  }
}

