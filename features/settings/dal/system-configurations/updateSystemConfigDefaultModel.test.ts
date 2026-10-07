import updateSystemConfigDefaultModel from '@/features/settings/dal/system-configurations/updateSystemConfigDefaultModel';
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

describe('updateSystemConfigDefaultModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  let modelId = '03f8d383-8027-4571-a41a-6b7c3a698f86';

  it('should update system config model if systemAiProviderModelId is null', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ systemAiProviderModelId: null });

    await updateSystemConfigDefaultModel(modelId);

    expect(updateSystemConfig).toHaveBeenCalledWith(SystemConfigFields.SystemAiProviderModelId, modelId);
  });

  it('should not update if modelId is not null and there is a system config model', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ systemAiProviderModelId: '8902ea1c-13ec-445e-b051-e49982c58104' });

    await updateSystemConfigDefaultModel(modelId);

    expect(updateSystemConfig).not.toHaveBeenCalled();
  });

  it('should update system config model if the current system model is deleted', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ systemAiProviderModelId: '03f8d383-8027-4571-a41a-6b7c3a698f86' });
    (db.model.findFirst as jest.Mock)
      .mockResolvedValueOnce({ deletedAt: '2023-01-01T00:00:00Z' }) // current system model
      .mockResolvedValueOnce({ id: '8902ea1c-13ec-445e-b051-e49982c58104' }); // next active model

    await updateSystemConfigDefaultModel();

    expect(updateSystemConfig).toHaveBeenCalledWith(SystemConfigFields.SystemAiProviderModelId, '8902ea1c-13ec-445e-b051-e49982c58104');
  });

  it('should not update system config model there is no modelId and the current system model is not deleted', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ systemAiProviderModelId: '03f8d383-8027-4571-a41a-6b7c3a698f86' });
    (db.model.findFirst as jest.Mock)
      .mockResolvedValueOnce({ deletedAt: null }); // current system model

    await updateSystemConfigDefaultModel();

    expect(updateSystemConfig).not.toHaveBeenCalled();
  });

  it('should handle errors and log them', async () => {
    const error = new Error('Test error');
    (db.systemConfig.findFirst as jest.Mock).mockRejectedValue(error);
    modelId = '';

    await expect(updateSystemConfigDefaultModel(modelId)).rejects.toThrow('Error updating system config default model');
    expect(logger.error).toHaveBeenCalledWith('Error updating system config default model', error);
  });
});
