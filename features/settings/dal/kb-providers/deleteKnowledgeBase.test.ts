import db from '@/server/db';
import deleteKnowledgeBase from '@/features/settings/dal/kb-providers/deleteKnowledgeBase';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

const mockUpdateKnowledgeBase = jest.fn();

(db.$transaction as jest.Mock).mockImplementation(async (callback) => {
  return callback({
    knowledgeBase: {
      update: mockUpdateKnowledgeBase,
    },
  });
});

describe('deleteKnowledgeBase', () => {
  const mockKnowledgeBaseId = 'a8cccffc-b523-4219-a242-71ecec71dcc6';
  const mockKnowledgeBase = {
    id: mockKnowledgeBaseId,
    label: 'Test Label',
    externalId: '123',
    kbProviderId: 'b8cccffc-b523-4219-a242-71ecec71dcc6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should soft delete knowledge base successfully', async () => {
    mockUpdateKnowledgeBase.mockResolvedValueOnce(mockKnowledgeBase);
    mockUpdateKnowledgeBase.mockResolvedValueOnce({
      ...mockKnowledgeBase,
      deletedAt: new Date(),
    });

    const result = await deleteKnowledgeBase(mockKnowledgeBaseId);

    expect(result).toEqual({ id: mockKnowledgeBaseId });
    expect(mockUpdateKnowledgeBase).toHaveBeenCalledTimes(2);
    expect(mockUpdateKnowledgeBase).toHaveBeenNthCalledWith(1, {
      where: { id: mockKnowledgeBaseId },
      data: { users: { set: [] } },
    });
    expect(mockUpdateKnowledgeBase).toHaveBeenNthCalledWith(2, {
      where: { id: mockKnowledgeBaseId, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should throw an error if delete fails', async () => {
    const mockError = new Error('Error deleting knowledge base');
    (db.$transaction as jest.Mock).mockRejectedValue(mockError);

    await expect(deleteKnowledgeBase(mockKnowledgeBaseId)).rejects.toThrow(
      'Error deleting knowledge base'
    );
  });
});
