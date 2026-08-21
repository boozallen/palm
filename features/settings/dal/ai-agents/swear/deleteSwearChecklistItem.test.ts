import db from '@/server/db';
import deleteSwearChecklistItem from './deleteSwearChecklistItem';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  agentSwearChecklistItem: {
    delete: jest.fn(),
  },
}));

describe('deleteSwearChecklistItem', () => {
  const mockItemId = '223e4567-e89b-12d3-a456-426614174001';
  const mockAgentId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentSwearChecklistItem.delete as jest.Mock).mockResolvedValue({
      id: mockItemId,
      aiAgentId: mockAgentId,
    });
  });

  it('should delete the checklist item', async () => {
    await deleteSwearChecklistItem(mockItemId);

    expect(db.agentSwearChecklistItem.delete).toHaveBeenCalledWith({
      where: { id: mockItemId },
      select: {
        id: true,
        aiAgentId: true,
      },
    });
  });

  it('should return the deleted item id and agent id', async () => {
    const result = await deleteSwearChecklistItem(mockItemId);

    expect(result).toEqual({
      id: mockItemId,
      aiAgentId: mockAgentId,
    });
  });

  it('should throw an error if deletion fails', async () => {
    (db.agentSwearChecklistItem.delete as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(deleteSwearChecklistItem(mockItemId)).rejects.toThrow();
  });

  it('should log an error if deletion fails', async () => {
    const mockError = new Error('DB error');
    (db.agentSwearChecklistItem.delete as jest.Mock).mockRejectedValue(mockError);

    await expect(deleteSwearChecklistItem(mockItemId)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error deleting SWEAR checklist item', mockError);
  });
});
