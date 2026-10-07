import db from '@/server/db';
import seedDefaultChecklistItems from './seedDefaultChecklistItems';
import logger from '@/server/logger';
import defaultChecklistItems from '@/features/ai-agents/types/swear/defaultChecklistItems';

jest.mock('@/server/db', () => ({
  agentSwearChecklistItem: {
    createMany: jest.fn(),
  },
}));

describe('seedDefaultChecklistItems', () => {
  const mockAgentId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentSwearChecklistItem.createMany as jest.Mock).mockResolvedValue({
      count: defaultChecklistItems.length,
    });
  });

  it('should create checklist items with correct data', async () => {
    await seedDefaultChecklistItems(mockAgentId);

    const expectedData = defaultChecklistItems.map((item) => ({
      aiAgentId: mockAgentId,
      category: item.category,
      item: item.item,
      sortOrder: item.sortOrder,
    }));

    expect(db.agentSwearChecklistItem.createMany).toHaveBeenCalledWith({
      data: expectedData,
    });
  });

  it('should log success message', async () => {
    await seedDefaultChecklistItems(mockAgentId);

    expect(logger.info).toHaveBeenCalledWith(
      `Seeded ${defaultChecklistItems.length} default checklist items for SWEAR agent ${mockAgentId}`
    );
  });

  it('should throw an error if creation fails', async () => {
    (db.agentSwearChecklistItem.createMany as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(seedDefaultChecklistItems(mockAgentId)).rejects.toThrow('Error seeding default SWEAR checklist items');
  });

  it('should log an error if creation fails', async () => {
    const mockError = new Error('DB error');
    (db.agentSwearChecklistItem.createMany as jest.Mock).mockRejectedValue(mockError);

    await expect(seedDefaultChecklistItems(mockAgentId)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error seeding default SWEAR checklist items:', mockError);
  });
});
