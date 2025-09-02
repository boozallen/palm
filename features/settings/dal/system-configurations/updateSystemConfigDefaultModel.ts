import logger from '@/server/logger';
import db from '@/server/db';
import updateSystemConfig from '@/features/settings/dal/system-configurations/updateSystemConfig';
import { SystemConfigFields } from '@/features/shared/types';

export default async function updateSystemConfigDefaultModel(modelId?: string) {
  try {
    const systemConfig = await db.systemConfig.findFirst({
      select: {
        systemAiProviderModelId: true,
      },
    });

    const currentSystemModel = systemConfig?.systemAiProviderModelId ?? null;

    if (currentSystemModel === null && modelId) {
      await updateSystemConfig(SystemConfigFields.SystemAiProviderModelId, modelId);
    } else if (!modelId && currentSystemModel) {

      const systemModel = await db.model.findFirst({
        where: {
          id: currentSystemModel,
        },
        select: {
          deletedAt: true,
        },
      });

      if (systemModel?.deletedAt) {
        const newModel = await db.model.findFirst({
          where: {
            deletedAt: null,
          },
        });
        await updateSystemConfig(SystemConfigFields.SystemAiProviderModelId, newModel?.id ?? null);
      }
      else {
        logger.info('No update needed for the system config default model');
      }
    } else {
      logger.info('No update needed for the system config default model');
    }
  } catch (error) {
    logger.error('Error updating system config default model', error);
    throw new Error('Error updating system config default model');
  }
}
