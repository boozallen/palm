import updateSystemConfigFastModel from '@/features/settings/dal/system-configurations/updateSystemConfigFastModel';
import logger from '@/server/logger';
import db from '@/server/db';
import updateSystemConfig from '@/features/settings/dal/system-configurations/updateSystemConfig';
import { SystemConfigFields } from '@/features/shared/types';

jest.mock('@/server/db', () => ({
  systemConfig: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  model: {
    findFirst: jest.fn(),
  },
})
);

jest.mock('@/features/settings/dal/system-configurations/updateSystemConfig');

describe('updateSystemConfigFastModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  let modelId = '03f8d383-8027-4571-a41a-6b7c3a698f86';

  it('sets the fast model when none is configured', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ fastAiProviderModelId: null });

    await updateSystemConfigFastModel(modelId);

    expect(updateSystemConfig).toHaveBeenCalledWith(SystemConfigFields.FastAiProviderModelId, modelId);
  });

  it('does not overwrite an existing fast model when a new model is added', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ fastAiProviderModelId: '8902ea1c-13ec-445e-b051-e49982c58104' });

    await updateSystemConfigFastModel(modelId);

    expect(updateSystemConfig).not.toHaveBeenCalled();
  });

  it('replaces the fast model when the current one is soft-deleted', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ fastAiProviderModelId: '03f8d383-8027-4571-a41a-6b7c3a698f86' });
    (db.model.findFirst as jest.Mock)
      .mockResolvedValueOnce({ deletedAt: '2023-01-01T00:00:00Z' })
      .mockResolvedValueOnce({ id: '8902ea1c-13ec-445e-b051-e49982c58104' });

    await updateSystemConfigFastModel();

    expect(updateSystemConfig).toHaveBeenCalledWith(SystemConfigFields.FastAiProviderModelId, '8902ea1c-13ec-445e-b051-e49982c58104');
  });

  it('leaves the fast model unchanged when it is still active', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ fastAiProviderModelId: '03f8d383-8027-4571-a41a-6b7c3a698f86' });
    (db.model.findFirst as jest.Mock)
      .mockResolvedValueOnce({ deletedAt: null });

    await updateSystemConfigFastModel();

    expect(updateSystemConfig).not.toHaveBeenCalled();
  });

  it('logs and rethrows on failure', async () => {
    const error = new Error('Test error');
    (db.systemConfig.findFirst as jest.Mock).mockRejectedValue(error);
    modelId = '';

    await expect(updateSystemConfigFastModel(modelId)).rejects.toThrow('Error updating fast AI provider model');
    expect(logger.error).toHaveBeenCalledWith('Error updating fast AI provider model', error);
  });
});
