import db from '@/server/db';
import logger from '@/server/logger';

export default async function updateUserKbSettingsMinScore(
  userId: string,
  knowledgeBasesMinScore: number | null,
): Promise<{ knowledgeBasesMinScore: number | null }> {
  try {
    const updatedUser = await db.user.update({
      where: {
        id: userId,
      },
      data: {
        knowledgeBasesMinScore: knowledgeBasesMinScore,
      },
    });

    return { knowledgeBasesMinScore: updatedUser.knowledgeBasesMinScore };

  } catch (error) {
    logger.error('Error updating knowledge bases min score', error);
    throw new Error('Error updating knowledge bases min score');
  }
}
