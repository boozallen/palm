import db from '@/server/db';
import createSwearChecklistItem from './createSwearChecklistItem';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  agentSwearChecklistItem: {
    create: jest.fn(),
  },
}));

describe('createSwearChecklistItem', () => {
  const mockInput = {
    aiAgentId: '123e4567-e89b-12d3-a456-426614174000',
    category: 'Preliminary Information',
    item: 'Have you identified the jurisdiction?',
    sortOrder: 1,
  };

  (db.agentSwearChecklistItem.create as jest.Mock).mockResolvedValue({
    id: '223e4567-e89b-12d3-a456-426614174001',
    ...mockInput,
  });

  beforeEach(jest.clearAllMocks);

  it('should create a new checklist item', async () => {
    await createSwearChecklistItem(mockInput);

    expect(db.agentSwearChecklistItem.create).toHaveBeenCalledWith({
      data: mockInput,
    });
  });

  it('should return the created checklist item', async () => {
    const result = await createSwearChecklistItem(mockInput);

    expect(result).toEqual({
      id: '223e4567-e89b-12d3-a456-426614174001',
      aiAgentId: '123e4567-e89b-12d3-a456-426614174000',
      category: 'Preliminary Information',
      item: 'Have you identified the jurisdiction?',
      sortOrder: 1,
    });
  });

  it('should throw an error if creation fails', async () => {
    (db.agentSwearChecklistItem.create as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(createSwearChecklistItem(mockInput)).rejects.toThrow('Error creating SWEAR checklist item');
  });

  it('should log an error if creation fails', async () => {
    const mockError = new Error('DB error');
    (db.agentSwearChecklistItem.create as jest.Mock).mockRejectedValue(mockError);

    await expect(createSwearChecklistItem(mockInput)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error creating SWEAR checklist item:', mockError);
  });
});
