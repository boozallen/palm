import logger from '@/server/logger';
import db from '@/server/db';
import { UserPreselectedKnowledgeBases } from '@/features/shared/routes/get-user-preselected-knowledge-bases';

export default async function getUserPreselectedKnowledgeBases(
  userId: string
): Promise<UserPreselectedKnowledgeBases> {
  try {
    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        knowledgeBases: {
          where: {
            deletedAt: null,
            kbProvider: {
              userGroups: {
                some: {
                  userGroupMemberships: {
                    some: {
                      userId: userId,
                    },
                  },
                },
              },
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      logger.error(`User not found with id: ${userId}`);
      throw new Error('User not found');
    }

    const userPreselectedKnowledgeBasesData = {
      userPreselectedKnowledgeBases: user.knowledgeBases.map(
        (knowledgeBase) => ({
          id: knowledgeBase.id,
        })
      ),
    };

    return userPreselectedKnowledgeBasesData;
  } catch (error) {
    logger.error('Error fetching preselected Knowledge Bases', error);
    throw new Error('Error fetching preselected Knowledge Bases');
  }
}
