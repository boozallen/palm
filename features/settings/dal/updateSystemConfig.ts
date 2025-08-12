import logger from '@/server/logger';
import db from '@/server/db';
import { SystemConfigFields } from '@/features/shared/types';

export default async function updateSystemConfig(
  configField: SystemConfigFields,
  configValue: string | boolean | null
) {
  try {
    let valueToUpdate: string | boolean | null = configValue;

    switch (configField) {
      case SystemConfigFields.FeatureManagementPromptGenerator:
      case SystemConfigFields.FeatureManagementChatSummarization:
      case SystemConfigFields.FeatureManagementPromptTagSuggestions:
        if (typeof configValue === 'string') {
          valueToUpdate = configValue.toLowerCase() === 'true';
        } else if (typeof configValue === 'boolean') {
          valueToUpdate = configValue;
        } else {
          valueToUpdate = Boolean(configValue);
        }
        break;

      default:
        break;
    }

    const updateResult = await db.systemConfig.updateMany({
      data: {
        [configField]: valueToUpdate,
      },
    });

    if (updateResult.count === 0) {
      logger.warn('Update failed: No matching records found to update.');
      throw new Error('Update failed: No matching records found to update.');
    }

    logger.debug('db.systemConfig.updateMany', { updateResult });
    logger.info(`System configuration ${configField} updated.`);

    return {
      count: updateResult.count,
      updatedField: configField,
      updatedValue: configValue,
    };
  } catch (error) {
    logger.error('Error updating System Config', error);
    throw new Error('Error updating System Config');
  }
}
