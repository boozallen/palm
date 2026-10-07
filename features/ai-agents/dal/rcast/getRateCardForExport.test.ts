import db from '@/server/db';
import getRateCardForExport from './getRateCardForExport';

jest.mock('@/server/db', () => ({
  rateCard: {
    findFirst: jest.fn(),
  },
}));

describe('getRateCardForExport', () => {
  const mockRateCardId = 'rate-card-123';
  const mockAgentId = 'agent-456';

  const mockRateCard = {
    filename: 'test_rate_card.xlsx',
    rateCardCategories: [
      {
        laborCategoryName: 'Software Engineer',
        experienceLevel: 'Senior',
        billRate: 150.0,
        mappedSocCode: '15-1252',
        mappedSocTitle: 'Software Developers',
        blsSalaryData: { meanHourlyWage: 55.5 },
        dolSalaryData: { hourlyMedian: 52.0 },
      },
      {
        laborCategoryName: 'Data Scientist',
        experienceLevel: 'Junior',
        billRate: null,
        mappedSocCode: '15-2051',
        mappedSocTitle: 'Data Scientists',
        blsSalaryData: null,
        dolSalaryData: null,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.rateCard.findFirst as jest.Mock).mockResolvedValue(mockRateCard);
  });

  it('should fetch rate card with categories for the given rate card and agent', async () => {
    await getRateCardForExport(mockRateCardId, mockAgentId);

    expect(db.rateCard.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockRateCardId,
        agentId: mockAgentId,
      },
      select: {
        filename: true,
        rateCardCategories: {
          select: {
            laborCategoryName: true,
            experienceLevel: true,
            billRate: true,
            mappedSocCode: true,
            mappedSocTitle: true,
            blsSalaryData: true,
            dolSalaryData: true,
          },
          orderBy: [
            { laborCategoryName: 'asc' },
            { experienceLevel: 'asc' },
          ],
        },
      },
    });
  });

  it('should return rate card data with categories mapped correctly', async () => {
    const result = await getRateCardForExport(mockRateCardId, mockAgentId);

    expect(result).toEqual({
      filename: 'test_rate_card.xlsx',
      categories: mockRateCard.rateCardCategories,
    });
  });

  it('should return null when rate card not found', async () => {
    (db.rateCard.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getRateCardForExport(mockRateCardId, mockAgentId);

    expect(result).toBeNull();
  });

  it('should return empty categories array when rate card has no categories', async () => {
    (db.rateCard.findFirst as jest.Mock).mockResolvedValue({
      filename: 'empty_rate_card.xlsx',
      rateCardCategories: [],
    });

    const result = await getRateCardForExport(mockRateCardId, mockAgentId);

    expect(result).toEqual({
      filename: 'empty_rate_card.xlsx',
      categories: [],
    });
  });
});
