import db from '@/server/db';
import logger from '@/server/logger';
import { KnowledgeBase } from '@/features/shared/types';

/**
 * Retrieves all knowledge bases from the database.
 * @returns A promise that resolves to an array of KnowledgeBase objects.
 */
export default async function getKnowledgeBases(): Promise<KnowledgeBase[]> {
  try {
    const records = await db.knowledgeBase.findMany({
      where: { deletedAt: null },
    });

    const result: KnowledgeBase[] = records.map((result) => {

      const knowledgeBase: KnowledgeBase = {
        id: result.id,
        label: result.label,
        externalId: result.externalId,
        kbProviderId: result.kbProviderId,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      return knowledgeBase;
    });

    return result;
  } catch (error) {
    logger.error('Error fetching knowledge bases', error);
    throw new Error('Error fetching knowledge bases');
  }
}
