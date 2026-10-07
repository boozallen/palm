import db from '@/server/db';
import logger from '@/server/logger';

/**
Function that validates a user's access to a knowledge base

* @param {string} knowledgeBaseId - Knowledge base to validate
* @param {string} userId - User requesting the knowledge base
* @returns {boolean} True if user has access to the knowledge base, false otherwise
*/
export default async function getUserHasKnowledgeBaseAccess(
  knowledgeBaseId: string,
  userId: string
): Promise<boolean> {

  try {
    const knowledgeBase = await db.knowledgeBase.findUnique({
      where: {
        id: knowledgeBaseId,
        deletedAt: null,
        kbProvider: {
          userGroups: {
            some: {
              userGroupMemberships: {
                some: {
                  userId,
                },
              },
            },
          },
        },
      },
    });

    return !!knowledgeBase;
  } catch (error) {
    logger.error('Error fetching user knowledge bases', error);
    throw new Error('Error fetching user knowledge bases');
  }
}
