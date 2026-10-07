import db from '@/server/db';
import getSwearChecklistItems from './getSwearChecklistItems';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  agentSwearChecklistItem: {
    findMany: jest.fn(),
  },
}));

describe('getSwearChecklistItems', () => {
  const mockAgentId = '123e4567-e89b-12d3-a456-426614174000';

  const mockItems = [
    {
      id: '223e4567-e89b-12d3-a456-426614174001',
      aiAgentId: mockAgentId,
      category: 'Preliminary Information',
      item: 'Have you identified the jurisdiction?',
      sortOrder: 1,
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174002',
      aiAgentId: mockAgentId,
      category: 'Probable Cause',
      item: 'Have you indicated the basis of your knowledge?',
      sortOrder: 1,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentSwearChecklistItem.findMany as jest.Mock).mockResolvedValue(mockItems);
  });

  it('should query checklist items with correct parameters', async () => {
    await getSwearChecklistItems(mockAgentId);

    expect(db.agentSwearChecklistItem.findMany).toHaveBeenCalledWith({
      where: {
        aiAgentId: mockAgentId,
      },
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' },
      ],
    });
  });

  it('should return formatted checklist items', async () => {
    const result = await getSwearChecklistItems(mockAgentId);

    expect(result).toEqual([
      {
        id: '223e4567-e89b-12d3-a456-426614174001',
        aiAgentId: mockAgentId,
        category: 'Preliminary Information',
        item: 'Have you identified the jurisdiction?',
        sortOrder: 1,
      },
      {
        id: '223e4567-e89b-12d3-a456-426614174002',
        aiAgentId: mockAgentId,
        category: 'Probable Cause',
        item: 'Have you indicated the basis of your knowledge?',
        sortOrder: 1,
      },
    ]);
  });

  it('should return empty array when no items found', async () => {
    (db.agentSwearChecklistItem.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getSwearChecklistItems(mockAgentId);

    expect(result).toEqual([]);
  });

  it('should throw an error if query fails', async () => {
    (db.agentSwearChecklistItem.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(getSwearChecklistItems(mockAgentId)).rejects.toThrow('Error fetching SWEAR checklist items');
  });

  it('should log an error if query fails', async () => {
    const mockError = new Error('DB error');
    (db.agentSwearChecklistItem.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getSwearChecklistItems(mockAgentId)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error fetching SWEAR checklist items: ', mockError);
  });
});
