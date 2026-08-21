import updateSystemConfigKnowledgeGraphModel from '@/features/settings/dal/system-configurations/updateSystemConfigKnowledgeGraphModel';
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

describe('updateSystemConfigKnowledgeGraphModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  let modelId = '03f8d383-8027-4571-a41a-6b7c3a698f86';

  it('should update knowledge graph config model if knowledgeGraphAiProviderModelId is null', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ knowledgeGraphAiProviderModelId: null });

    await updateSystemConfigKnowledgeGraphModel(modelId);

    expect(updateSystemConfig).toHaveBeenCalledWith(SystemConfigFields.KnowledgeGraphAiProviderModelId, modelId);
  });

  it('should not update if modelId is not null and there is a knowledge graph config model', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ knowledgeGraphAiProviderModelId: '8902ea1c-13ec-445e-b051-e49982c58104' });

    await updateSystemConfigKnowledgeGraphModel(modelId);

    expect(updateSystemConfig).not.toHaveBeenCalled();
  });

  it('should update knowledge graph config model if the current knowledge graph model is deleted', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ knowledgeGraphAiProviderModelId: '03f8d383-8027-4571-a41a-6b7c3a698f86' });
    (db.model.findFirst as jest.Mock)
      .mockResolvedValueOnce({ deletedAt: '2023-01-01T00:00:00Z' }) // current knowledge graph model
      .mockResolvedValueOnce({ id: '8902ea1c-13ec-445e-b051-e49982c58104' }); // next active model

    await updateSystemConfigKnowledgeGraphModel();

    expect(updateSystemConfig).toHaveBeenCalledWith(SystemConfigFields.KnowledgeGraphAiProviderModelId, '8902ea1c-13ec-445e-b051-e49982c58104');
  });

  it('should not update knowledge graph config model there is no modelId and the current knowledge graph model is not deleted', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({ knowledgeGraphAiProviderModelId: '03f8d383-8027-4571-a41a-6b7c3a698f86' });
    (db.model.findFirst as jest.Mock)
      .mockResolvedValueOnce({ deletedAt: null }); // current knowledge graph model

    await updateSystemConfigKnowledgeGraphModel();

    expect(updateSystemConfig).not.toHaveBeenCalled();
  });

  it('should handle errors and log them', async () => {
    const error = new Error('Test error');
    (db.systemConfig.findFirst as jest.Mock).mockRejectedValue(error);
    modelId = '';

    await expect(updateSystemConfigKnowledgeGraphModel(modelId)).rejects.toThrow('Error updating knowledge graph AI provider model');
    expect(logger.error).toHaveBeenCalledWith('Error updating knowledge graph AI provider model', error);
  });
});