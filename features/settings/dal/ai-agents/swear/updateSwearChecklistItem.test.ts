import db from '@/server/db';
import updateSwearChecklistItem from './updateSwearChecklistItem';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  agentSwearChecklistItem: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

describe('updateSwearChecklistItem', () => {
  const mockInput = {
    id: '223e4567-e89b-12d3-a456-426614174001',
    category: 'Preliminary Information',
    item: 'Updated checklist item text',
    sortOrder: 2,
  };

  const mockAgentId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentSwearChecklistItem.findUnique as jest.Mock).mockResolvedValue({
      id: mockInput.id,
    });
    (db.agentSwearChecklistItem.update as jest.Mock).mockResolvedValue({
      ...mockInput,
      aiAgentId: mockAgentId,
    });
  });

  it('should find the checklist item before updating', async () => {
    await updateSwearChecklistItem(mockInput);

    expect(db.agentSwearChecklistItem.findUnique).toHaveBeenCalledWith({
      where: { id: mockInput.id },
      select: { id: true },
    });
  });

  it('should update the checklist item', async () => {
    await updateSwearChecklistItem(mockInput);

    expect(db.agentSwearChecklistItem.update).toHaveBeenCalledWith({
      where: { id: mockInput.id },
      data: {
        category: mockInput.category,
        item: mockInput.item,
        sortOrder: mockInput.sortOrder,
      },
      select: {
        id: true,
        category: true,
        item: true,
        sortOrder: true,
        aiAgentId: true,
      },
    });
  });

  it('should return the updated checklist item', async () => {
    const result = await updateSwearChecklistItem(mockInput);

    expect(result).toEqual({
      id: mockInput.id,
      category: mockInput.category,
      item: mockInput.item,
      sortOrder: mockInput.sortOrder,
      aiAgentId: mockAgentId,
    });
  });

  it('should throw an error if item not found', async () => {
    (db.agentSwearChecklistItem.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(updateSwearChecklistItem(mockInput)).rejects.toThrow('Error updating SWEAR checklist item');
  });

  it('should log a warning if item not found', async () => {
    (db.agentSwearChecklistItem.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(updateSwearChecklistItem(mockInput)).rejects.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(`SWEAR checklist item could not be found: ${mockInput.id}`);
  });

  it('should throw an error if update fails', async () => {
    (db.agentSwearChecklistItem.update as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(updateSwearChecklistItem(mockInput)).rejects.toThrow('Error updating SWEAR checklist item');
  });

  it('should log an error if update fails', async () => {
    const mockError = new Error('DB error');
    (db.agentSwearChecklistItem.update as jest.Mock).mockRejectedValue(mockError);

    await expect(updateSwearChecklistItem(mockInput)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error updating SWEAR checklist item', mockError);
  });
});
