import logger from '@/server/logger';
import db from '@/server/db';
import updateSystemConfig from '@/features/settings/dal/system-configurations/updateSystemConfig';
import { SystemConfigFields } from '@/features/shared/types';

export default async function updateSystemConfigKnowledgeGraphModel(modelId?: string) {
  try {
    const systemConfig = await db.systemConfig.findFirst({
      select: {
        knowledgeGraphAiProviderModelId: true,
      },
    });

    const currentKnowledgeGraphModel = systemConfig?.knowledgeGraphAiProviderModelId ?? null;

    if (currentKnowledgeGraphModel === null && modelId) {
      await updateSystemConfig(SystemConfigFields.KnowledgeGraphAiProviderModelId, modelId);
    } else if (!modelId && currentKnowledgeGraphModel) {

      const knowledgeGraphModel = await db.model.findFirst({
        where: {
          id: currentKnowledgeGraphModel,
        },
        select: {
          deletedAt: true,
        },
      });

      if (knowledgeGraphModel?.deletedAt) {
        const newModel = await db.model.findFirst({
          where: {
            deletedAt: null,
            // The knowledge graph model serves completions, so an embedding model
            // is not a valid replacement.
            embeddingsOnly: false,
          },
        });
        await updateSystemConfig(SystemConfigFields.KnowledgeGraphAiProviderModelId, newModel?.id ?? null);
      }
      else {
        logger.info('No update needed for the knowledge graph AI provider model');
      }
    } else {
      logger.info('No update needed for the knowledge graph AI provider model');
    }
  } catch (error) {
    logger.error('Error updating knowledge graph AI provider model', error);
    throw new Error('Error updating knowledge graph AI provider model');
  }
}