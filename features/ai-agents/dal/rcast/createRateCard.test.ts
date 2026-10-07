import db from '@/server/db';
import logger from '@/server/logger';
import createRateCard from './createRateCard';
import type { RateCardRow } from '@/features/ai-agents/utils/rcast/parseRateCard';

jest.mock('@/server/db', () => ({
  rateCard: {
    create: jest.fn(),
    update: jest.fn(),
  },
  rateCardCategory: {
    create: jest.fn(),
  },
}));

describe('createRateCard', () => {
  const mockInput = {
    aiAgentId: 'agent-123',
    userId: 'user-123',
    fileName: 'test-rate-card.xlsx',
    parsedRows: [
      {
        laborCategory: 'Software Engineer',
        experienceLevel: 'Senior',
        rate: 150.0,
      },
      {
        laborCategory: 'Data Scientist',
        experienceLevel: 'Mid-Level',
        rate: 125.0,
      },
    ] as RateCardRow[],
    userGroupId: null,
  };

  const mockRateCard = {
    id: 'rate-card-123',
    agentId: mockInput.aiAgentId,
    userId: mockInput.userId,
    filename: mockInput.fileName,
    uploadStatus: 'pending',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.rateCard.create as jest.Mock).mockResolvedValue(mockRateCard);
    (db.rateCardCategory.create as jest.Mock).mockResolvedValue({
      id: 'category-123',
    });
    (db.rateCard.update as jest.Mock).mockResolvedValue({
      ...mockRateCard,
      uploadStatus: 'completed',
    });
  });

  it('should throw if rateCard model not available', async () => {
    const originalRateCard = db.rateCard;
    Object.defineProperty(db, 'rateCard', { value: undefined, writable: true });

    await expect(createRateCard(mockInput)).rejects.toThrow(
      'Database schema error: rateCard model not available. Server restart may be required.'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Prisma client missing rateCard model',
      expect.objectContaining({
        availableModels: expect.any(Array),
      })
    );

    Object.defineProperty(db, 'rateCard', { value: originalRateCard, writable: true });
  });

  it('should create a rate card record', async () => {
    await createRateCard(mockInput);

    expect(db.rateCard.create).toHaveBeenCalledWith({
      data: {
        agentId: mockInput.aiAgentId,
        userId: mockInput.userId,
        filename: mockInput.fileName,
        uploadStatus: 'pending',
        userGroupId: null,
      },
    });
  });

  it('should persist the provided userGroupId', async () => {
    await createRateCard({ ...mockInput, userGroupId: 'group-1' });

    expect(db.rateCard.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userGroupId: 'group-1' }),
    });
  });

  it('should create category records for each parsed row', async () => {
    await createRateCard(mockInput);

    expect(db.rateCardCategory.create).toHaveBeenCalledTimes(2);
    expect(db.rateCardCategory.create).toHaveBeenCalledWith({
      data: {
        rateCardId: mockRateCard.id,
        laborCategoryName: 'Software Engineer',
        experienceLevel: 'Senior',
        billRate: 150.0,
      },
    });
    expect(db.rateCardCategory.create).toHaveBeenCalledWith({
      data: {
        rateCardId: mockRateCard.id,
        laborCategoryName: 'Data Scientist',
        experienceLevel: 'Mid-Level',
        billRate: 125.0,
      },
    });
  });

  it('should return success and failure counts', async () => {
    const result = await createRateCard(mockInput);

    expect(result).toEqual({
      rateCardId: mockRateCard.id,
      successCount: 2,
      failureCount: 0,
    });
  });

  it('should continue creating categories even if one fails', async () => {
    (db.rateCardCategory.create as jest.Mock)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ id: 'category-123' });

    const result = await createRateCard(mockInput);

    expect(result).toEqual({
      rateCardId: mockRateCard.id,
      successCount: 1,
      failureCount: 1,
    });
    expect(db.rateCardCategory.create).toHaveBeenCalledTimes(2);
  });

  it('should log errors when category creation fails', async () => {
    const mockError = new Error('DB error');
    (db.rateCardCategory.create as jest.Mock)
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce({ id: 'category-123' });

    await createRateCard(mockInput);

    expect(logger.error).toHaveBeenCalledWith(
      'Error creating rate card category:',
      {
        laborCategory: 'Software Engineer',
        error: mockError,
      }
    );
  });

  it('should throw when all categories fail to create', async () => {
    (db.rateCardCategory.create as jest.Mock).mockRejectedValue(
      new Error('DB error')
    );

    await expect(createRateCard(mockInput)).rejects.toThrow(
      'Failed to create any rate card categories.'
    );
  });

  it('should log rate card creation info', async () => {
    await createRateCard(mockInput);

    expect(logger.info).toHaveBeenCalledWith('Rate card created', {
      rateCardId: mockRateCard.id,
      successCount: 2,
      failureCount: 0,
    });
  });

  it('should store null bill rate for rows without a rate column', async () => {
    const rowsWithNullRate: RateCardRow[] = [
      { laborCategory: 'Analyst', experienceLevel: 'Junior', rate: null },
    ];

    await createRateCard({ ...mockInput, parsedRows: rowsWithNullRate });

    expect(db.rateCardCategory.create).toHaveBeenCalledWith({
      data: {
        rateCardId: mockRateCard.id,
        laborCategoryName: 'Analyst',
        experienceLevel: 'Junior',
        billRate: null,
      },
    });
  });
});
