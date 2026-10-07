import logger from '@/server/logger';
import db from '@/server/db';

export default async function deleteKnowledgeBase(
  id: string
): Promise<{ id: string }> {
  return db.$transaction(async (prisma) => {
    try {
      // disconnect all users associated with the KnowledgeBase to be deleted
      await prisma.knowledgeBase.update({
        where: { id: id },
        data: {
          users: {
            set: [],
          },
        },
      });

      // soft delete the KnowledgeBase after successfully disconnecting related users
      const deleteKnowledgeBase = await prisma.knowledgeBase.update({
        where: { id: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return { id: deleteKnowledgeBase.id };
    } catch (error) {
      logger.error('Error deleting knowledge base', error);
      throw new Error('Error deleting knowledge base');
    }
  });
}
