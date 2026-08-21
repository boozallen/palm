import db from '@/server/db';
import logger from '@/server/logger';

export default async function updateUserKbSettingsMaxResults(
  userId: string,
  knowledgeBasesMaxResults: number | null,
): Promise<{ knowledgeBasesMaxResults: number | null }> {
  try {
    const updatedUser = await db.user.update({
      where: {
        id: userId,
      },
      data: {
        knowledgeBasesMaxResults: knowledgeBasesMaxResults,
      },
    });

    return { knowledgeBasesMaxResults: updatedUser.knowledgeBasesMaxResults };

  } catch (error) {
    logger.error('Error updating knowledge bases max results', error);
    throw new Error('Error updating knowledge bases max results');
  }
}
