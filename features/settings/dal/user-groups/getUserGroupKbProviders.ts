import { KbProvider, kbProviderConfigSchema } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

export default async function getUserGroupKbProviders(
  userGroupId: string
): Promise<KbProvider[]> {
  let results;

  try {
    results = await db.kbProvider.findMany({
      where: {
        deletedAt: null,
        userGroups: {
          some: {
            id: userGroupId,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching user group knowledge base providers', error);
    throw new Error('Error fetching user group knowledge base providers');
  }

  if (!results.length) {
    logger.warn('No knowledge base providers for user group');
    return [];
  }

  return results.map((kbProvider): KbProvider => {
    try {
      return {
        id: kbProvider.id,
        label: kbProvider.label,
        config: kbProviderConfigSchema.parse(kbProvider.config),
        kbProviderType: kbProvider.kbProviderType,
        createdAt: kbProvider.createdAt,
        updatedAt: kbProvider.updatedAt,
      };
    } catch (error) {
      logger.error(
        'User group Knowledge base providers config is invalid',
        error
      );
      throw new Error('Error fetching user group knowledge base providers');
    }
  });
}
