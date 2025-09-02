import logger from '@/server/logger';
import db from '@/server/db';

export default async function deleteKbProvider(kbProviderId: string) {

  return await db.$transaction(async (prisma) => {

    try {
      // Soft delete knowledge bases associated with the kbProvider
      await prisma.knowledgeBase.updateMany({
        where: { kbProviderId: kbProviderId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      const deletedKbProvider = await prisma.kbProvider.update({
        where: { id: kbProviderId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      if (!deletedKbProvider) {
        logger.warn('Unable to find the requested Knowledge Base provider');
        throw new Error('Unable to find the requested Knowledge Base provider');
      }
      return { id: deletedKbProvider.id };

    } catch (error) {
      logger.error('Error deleting the Knowledge Base provider', error);
      throw new Error('Error deleting the Knowledge Base provider');
    }

  });
}
