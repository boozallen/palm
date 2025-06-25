import updateSystemConfigDocumentLibraryKbProvider from '@/features/settings/dal/updateSystemConfigDocumentLibraryKbProvider';
import logger from '@/server/logger';
import db from '@/server/db';
import updateSystemConfig from '@/features/settings/dal/updateSystemConfig';
import { SystemConfigFields } from '@/features/shared/types';

jest.mock('@/server/db', () => ({
  systemConfig: {
    findFirst: jest.fn(),
  },
}));

jest.mock('@/features/settings/dal/updateSystemConfig');

describe('updateSystemConfigDocumentLibraryKbProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set documentLibraryKbProviderId to null if kbProviderId matches', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ documentLibraryKbProviderId: 'test-kb-provider-id' });

    await updateSystemConfigDocumentLibraryKbProvider('test-kb-provider-id');

    expect(updateSystemConfig).toHaveBeenCalledWith(SystemConfigFields.DocumentLibraryKbProviderId, null);
    expect(logger.debug).toHaveBeenCalledWith('System config documentLibraryKbProviderId set to null');
  });

  it('should not update if kbProviderId does not match documentLibraryKbProviderId', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ documentLibraryKbProviderId: 'different-kb-provider-id' });

    await updateSystemConfigDocumentLibraryKbProvider('test-kb-provider-id');

    expect(updateSystemConfig).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('No update needed for the system config documentLibraryKbProviderId');
  });

  it('should handle errors and log them', async () => {
    const error = new Error('Test error');
    (db.systemConfig.findFirst as jest.Mock).mockRejectedValue(error);

    await expect(updateSystemConfigDocumentLibraryKbProvider('test-kb-provider-id')).rejects.toThrow('Error updating system config documentLibraryKbProviderId');
    expect(logger.error).toHaveBeenCalledWith('Error updating system config documentLibraryKbProviderId', error);
  });
});
