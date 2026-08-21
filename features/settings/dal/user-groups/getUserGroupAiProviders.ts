import { Provider } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';
import buildProvider from '@/features/shared/dal/buildProvider';

export default async function getUserGroupAiProviders(
  id: string
): Promise<Provider[]> {
  try {
    const results = await db.userGroup.findUniqueOrThrow({
      where: {
        id: id,
      },
      select: {
        aiProviders: true,
      },
    });

    const providers: Provider[] = [];

    for (const result of results.aiProviders) {
      providers.push(await buildProvider(db, result));
    }

    return providers;
  } catch (error) {
    logger.error('Error getting user group AI providers', error);
    throw new Error('Error getting user group AI providers');
  }
}
