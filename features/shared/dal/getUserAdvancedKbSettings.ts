import db from '@/server/db';
import logger from '@/server/logger';

type UserAdvancedKbSettings = {
  knowledgeBasesMinScore: number | null;
  knowledgeBasesMaxResults: number | null;
};

export default async function getUserAdvancedKbSettings(
  userId: string
): Promise<UserAdvancedKbSettings> {
  try {
    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        knowledgeBasesMinScore: true,
        knowledgeBasesMaxResults: true,
      },
    });

    if (!user) {
      logger.error(`User not found with id: ${userId}`);
      throw new Error('User not found');
    }

    return {
      knowledgeBasesMinScore: user.knowledgeBasesMinScore,
      knowledgeBasesMaxResults: user.knowledgeBasesMaxResults,
    };
  } catch (error) {
    logger.error('Error getting user advanced kb settings', error);
    throw new Error('Error getting user advanced knowledge base settings');
  }
}
