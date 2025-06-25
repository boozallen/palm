import logger from '@/server/logger';
import db from '@/server/db';
import updateSystemConfig from '@/features/settings/dal/updateSystemConfig';
import { SystemConfigFields } from '@/features/shared/types';

export default async function updateSystemConfigDocumentLibraryKbProvider(
  kbProviderId: string,
) {
  try {
    const systemConfig = await db.systemConfig.findFirst({
      select: {
        documentLibraryKbProviderId: true,
      },
    });

    const documentLibraryKbProviderId = systemConfig?.documentLibraryKbProviderId ?? null;

    if (kbProviderId === documentLibraryKbProviderId) {
      await updateSystemConfig(SystemConfigFields.DocumentLibraryKbProviderId, null);
      logger.debug('System config documentLibraryKbProviderId set to null');
    } else {
      logger.info('No update needed for the system config documentLibraryKbProviderId');
    }
  } catch (error) {
    logger.error('Error updating system config documentLibraryKbProviderId', error);
    throw new Error('Error updating system config documentLibraryKbProviderId');
  }
}
