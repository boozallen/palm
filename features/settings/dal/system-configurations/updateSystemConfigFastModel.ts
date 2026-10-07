import logger from '@/server/logger';
import db from '@/server/db';
import updateSystemConfig from '@/features/settings/dal/system-configurations/updateSystemConfig';
import { SystemConfigFields } from '@/features/shared/types';

export default async function updateSystemConfigFastModel(modelId?: string) {
  try {
    const systemConfig = await db.systemConfig.findFirst({
      select: {
        fastAiProviderModelId: true,
      },
    });

    const currentFastModel = systemConfig?.fastAiProviderModelId ?? null;

    if (currentFastModel === null && modelId) {
      await updateSystemConfig(SystemConfigFields.FastAiProviderModelId, modelId);
    } else if (!modelId && currentFastModel) {

      const fastModel = await db.model.findFirst({
        where: {
          id: currentFastModel,
        },
        select: {
          deletedAt: true,
        },
      });

      if (fastModel?.deletedAt) {
        const newModel = await db.model.findFirst({
          where: {
            deletedAt: null,
            embeddingsOnly: false,
          },
        });
        await updateSystemConfig(SystemConfigFields.FastAiProviderModelId, newModel?.id ?? null);
      }
      else {
        logger.info('No update needed for the fast AI provider model');
      }
    } else {
      logger.info('No update needed for the fast AI provider model');
    }
  } catch (error) {
    logger.error('Error updating fast AI provider model', error);
    throw new Error('Error updating fast AI provider model');
  }
}
