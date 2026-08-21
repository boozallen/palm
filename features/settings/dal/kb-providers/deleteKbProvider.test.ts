import deleteKbProvider from './deleteKbProvider';
import logger from '@/server/logger';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

const mockUpdateKnowledgeBase = jest.fn();
const mockUpdateKbProvider = jest.fn();

(db.$transaction as jest.Mock).mockImplementation(async (callback) => {
  return callback({
    knowledgeBase: { updateMany: mockUpdateKnowledgeBase },
    kbProvider: { update: mockUpdateKbProvider },
  });
});

describe('deleteKbProvider DAL function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete knowledge base provider and associated knowledge bases successfully', async () => {
    const kbProviderId = '7668dc6d-6a37-47ef-b4b1-83501b625336';
    const mockDeletedKbProvider = { id: kbProviderId };
    const mockUpdatedKnowledgeBases = { count: 2 };

    mockUpdateKnowledgeBase.mockResolvedValue(mockUpdatedKnowledgeBases);
    mockUpdateKbProvider.mockResolvedValue(mockDeletedKbProvider);

    const result = await deleteKbProvider(kbProviderId);

    expect(mockUpdateKnowledgeBase).toHaveBeenCalledWith({
      where: { kbProviderId: kbProviderId, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });

    expect(mockUpdateKbProvider).toHaveBeenCalledWith({
      where: { id: kbProviderId, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });

    expect(result).toEqual({
      id: kbProviderId,
    });
  });

  it('should throw an error if deletion fails', async () => {
    const kbProviderId = '7668dc6d-6a37-47ef-b4b1-83501b625336';
    const deleteError = new Error('Database error');

    mockUpdateKnowledgeBase.mockRejectedValue(deleteError);

    await expect(deleteKbProvider(kbProviderId)).rejects.toThrow(
      'Error deleting the Knowledge Base provider'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error deleting the Knowledge Base provider',
      deleteError
    );
  });

  it('should throw an error if the KB Provider does not exist', async () => {
    const kbProviderId = '7668dc6d-6a37-47ef-b4b1-83501b625336';
    mockUpdateKbProvider.mockResolvedValue(null);

    await expect(deleteKbProvider(kbProviderId)).rejects.toThrow(
      'Error deleting the Knowledge Base provider'
    );
  });
});
