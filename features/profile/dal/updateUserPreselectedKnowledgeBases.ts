import db from '@/server/db';
import logger from '@/server/logger';

export default async function updateUserPreselectedKnowledgeBases(userId: string, knowledgeBaseId: string, preselected: boolean):
  Promise<{ id: string }[]> {

  const connectToKnowledgeBase = {
    connect: {
      id: knowledgeBaseId,
    },
  };
  const disconnectFromKnowledgeBase = {
    disconnect: {
      id: knowledgeBaseId,
    },
  };

  try {
    const updatedUser = await db.user.update({
      where: {
        id: userId,
      },
      data: {
        knowledgeBases:
          preselected ? connectToKnowledgeBase : disconnectFromKnowledgeBase,
      },
      select: {
        knowledgeBases: {
          select: {
            id: true,
          },
        },
      },
    });

    const updatedUserPreselectedKnowledgeBases = updatedUser.knowledgeBases.map((knowledgeBase) => {
      return { id: knowledgeBase.id };
    });

    return updatedUserPreselectedKnowledgeBases;

  } catch (error) {
    logger.error('Error updating preselected knowledge bases', error);
    throw new Error('Error updating preselected knowledge bases');
  }
}
