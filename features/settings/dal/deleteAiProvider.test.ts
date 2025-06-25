import deleteAiProvider from './deleteAiProvider';
import { AiProviderType } from '@/features/shared/types';
import logger from '@/server/logger';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

const mockUpdateAiProvider = jest.fn();
const mockFindAiProvider = jest.fn();
const mockApiConfigOpenAi = jest.fn();
const mockApiConfigBedrock = jest.fn();
const mockFindModels = jest.fn();
const mockUpdateModels = jest.fn();
const mockFindChats = jest.fn();
const mockUpdateChats = jest.fn();

(db.$transaction as jest.Mock).mockImplementation(async (callback) => {
  return callback({
    apiConfigOpenAi: { update: mockApiConfigOpenAi },
    apiConfigBedrock: { update: mockApiConfigBedrock },
    aiProvider: { update: mockUpdateAiProvider, findUnique: mockFindAiProvider },
    model: { findMany: mockFindModels, updateMany: mockUpdateModels },
    chat: { findMany: mockFindChats, updateMany: mockUpdateChats },
  });
});

describe('deleteAiProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete AI provider successfully', async () => {
    const providerId = '1';
    const mockAiProvider = { aiProviderTypeId: AiProviderType.OpenAi, apiConfigId: 'openai123' };

    mockFindAiProvider.mockResolvedValueOnce(mockAiProvider);

    mockFindModels.mockResolvedValue([{ id: 'model123', aiProviderId: providerId }]);
    mockUpdateModels.mockResolvedValue([{ id: 'model123', deletedAt: new Date() }]);
    mockFindChats.mockResolvedValue([{ id: 'chat1', modelId: 'model123' }]);
    mockUpdateChats.mockResolvedValue([{ id: 'chat1', modelId: null }]);

    mockUpdateAiProvider.mockResolvedValue({ id: providerId });

    const result = await deleteAiProvider(providerId);

    expect(mockApiConfigOpenAi).toHaveBeenCalledWith({
      where: { id: mockAiProvider.apiConfigId, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });

    expect(mockUpdateAiProvider).toHaveBeenCalledWith({
      where: { id: providerId, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });

    expect(result).toEqual({ id: providerId });
  });

  it('should throw an error if deletion fails', async () => {
    const providerId = '1';
    const aiProviderMock = { aiProviderTypeId: AiProviderType.OpenAi, apiConfigId: 'openai123' };

    mockFindAiProvider.mockResolvedValueOnce(aiProviderMock);

    const deleteError = new Error('Ai Provider could not be retrieved');
    mockUpdateAiProvider.mockRejectedValueOnce(deleteError);

    await expect(deleteAiProvider(providerId)).rejects.toThrow('Error deleting the AI Provider');

    expect(mockFindAiProvider).toHaveBeenCalledWith({
      where: { id: providerId, deletedAt: null },
      select: { apiConfigId: true, aiProviderTypeId: true },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Error deleting the AI Provider',
      deleteError
    );
  });

  it('should throw an error if the AI Provider does not exist', async () => {
    const providerId = '1';
    mockFindAiProvider.mockResolvedValueOnce(null);

    const deleteError = new Error('Unable to find the requested AI provider');

    await expect(deleteAiProvider(providerId)).rejects.toThrow(deleteError);
  });

  describe('bedrock provider', () => {
    it('should delete bedrock provider successfully', async () => {
      const providerId = '1';
      const mockAiProvider = { aiProviderTypeId: AiProviderType.Bedrock, apiConfigId: 'bedrock123' };

      mockFindAiProvider.mockResolvedValueOnce(mockAiProvider);

      mockFindModels.mockResolvedValue([{ id: 'model123', aiProviderId: providerId }]);
      mockUpdateModels.mockResolvedValue([{ id: 'model123', deletedAt: new Date() }]);
      mockFindChats.mockResolvedValue([{ id: 'chat1', modelId: 'model123' }]);
      mockUpdateChats.mockResolvedValue([{ id: 'chat1', modelId: null }]);
      mockApiConfigBedrock.mockResolvedValue({ id: 'bedrock123' });

      mockUpdateAiProvider.mockResolvedValue({ id: providerId });

      const result = await deleteAiProvider(providerId);

      expect(mockUpdateAiProvider).toHaveBeenCalledWith({
        where: { id: providerId, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });

      expect(mockApiConfigBedrock).toHaveBeenCalledWith({
        where: { id: mockAiProvider.apiConfigId, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });

      expect(result).toEqual({ id: providerId });
    });
  });
});
