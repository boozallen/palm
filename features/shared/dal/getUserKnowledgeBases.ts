import { UserKnowledgeBase } from '@/features/shared/types/knowledge-base';
import logger from '@/server/logger';
import db from '@/server/db';

export default async function getUserKnowledgeBases(
  userId: string
): Promise<UserKnowledgeBase[]> {

  try {
    const results = await db.knowledgeBase.findMany({
      where: {
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
      include: {
        kbProvider: {
          select: {
            label: true,
          },
        },
      },
    });

    const userKnowledgeBases: UserKnowledgeBase[] = [];

    for (const result of results) {
      userKnowledgeBases.push({
        id: result.id,
        label: result.label,
        kbProviderId: result.kbProviderId,
        kbProviderLabel: result.kbProvider.label,
      });
    }

    return userKnowledgeBases;
  } catch (error) {
    logger.error('Error fetching user knowledge bases', error);
    throw new Error('Error fetching user knowledge bases');
  }
}
