import logger from '@/server/logger';
import db from '@/server/db';
import { AiProviderType } from '@/features/shared/types';

export default async function deleteAiProvider(providerId: string) {

  return await db.$transaction(async (prisma) => {

    let aiProvider = undefined;
    try {
      aiProvider = await prisma.aiProvider.findUnique({
        where: { id: providerId, deletedAt: null },
        select: { apiConfigId: true, aiProviderTypeId: true },
      });
    } catch (error) {
      logger.error('Error deleting the AI Provider', error);
      throw new Error('Error deleting the AI Provider');
    }

    if (!aiProvider) {
      logger.warn('Unable to find the requested AI provider');
      throw new Error('Unable to find the requested AI provider');
    }

    try {
      switch (aiProvider.aiProviderTypeId) {
        case AiProviderType.OpenAi:
          await prisma.apiConfigOpenAi.update({
            where: { id: aiProvider.apiConfigId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          break;
        case AiProviderType.AzureOpenAi:
          await prisma.apiConfigAzureOpenAi.update({
            where: { id: aiProvider.apiConfigId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          break;
        case AiProviderType.Anthropic:
          await prisma.apiConfigAnthropic.update({
            where: { id: aiProvider.apiConfigId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          break;
        case AiProviderType.Gemini:
          await prisma.apiConfigGemini.update({
            where: { id: aiProvider.apiConfigId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          break;
        case AiProviderType.Bedrock:
          await prisma.apiConfigBedrock.update({
            where: { id: aiProvider.apiConfigId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          break;
        default:
          logger.warn('AI Provider could not be retrieved');
          throw new Error('AI Provider could not be retrieved');
      }

      // Get the models related to the AI provider that haven't already been deleted
      const affectedModels = await prisma.model.findMany({
        where: { aiProviderId: providerId, deletedAt: null },
        select: { id: true },
      });

      // Set model to null in Chats that use the affected Models
      const affectedChatRecords = await prisma.chat.findMany({
        where: {
          modelId: { in: affectedModels.map(model => model.id) },
        },
        select: { id: true },
      });

      await prisma.chat.updateMany({
        where: {
          id: { in: affectedChatRecords.map(record => record.id) },
        },
        data: { modelId: null },
      });

      // Soft delete Models associated with the provider
      await prisma.model.updateMany({
        where: { aiProviderId: providerId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      const deletedProvider = await prisma.aiProvider.update({
        where: { id: providerId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      return { id: deletedProvider.id };

    } catch (error) {
      logger.error('Error deleting the AI Provider', error);
      throw new Error('Error deleting the AI Provider');
    }

  });
}
