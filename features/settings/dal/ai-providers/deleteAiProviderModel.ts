import logger from '@/server/logger';
import db from '@/server/db';

export default async function deleteAiProviderModel(modelId: string) {
  return db.$transaction(async (prisma) => {
    try {
      // Set the model to null in associated Chats
      await prisma.chat.updateMany({
        where: {
          modelId: modelId,
        },
        data: { modelId: null },
      });

      const deleteModel = await prisma.model.update({
        where: { id: modelId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return { id: deleteModel.id };
    } catch (error) {
      logger.error('Error deleting the AI provider model', error);
      throw new Error('Error deleting the AI provider model');
    }
  });
}
