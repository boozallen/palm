import db from '@/server/db';
import getCategoriesWithSocCodes from './getCategoriesWithSocCodes';

jest.mock('@/server/db', () => ({
  rateCardCategory: {
    findMany: jest.fn(),
  },
}));

describe('getCategoriesWithSocCodes', () => {
  const mockRateCardId = 'rate-card-123';

  const mockCategories = [
    {
      id: 'category-1',
      mappedSocCode: '15-1252.00',
      laborCategoryName: 'Software Engineer',
    },
    {
      id: 'category-2',
      mappedSocCode: '15-2051.00',
      laborCategoryName: 'Data Scientist',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (db.rateCardCategory.findMany as jest.Mock).mockResolvedValue(mockCategories);
  });

  it('should fetch categories with mapped SOC codes', async () => {
    await getCategoriesWithSocCodes(mockRateCardId);

    expect(db.rateCardCategory.findMany).toHaveBeenCalledWith({
      where: {
        rateCardId: mockRateCardId,
        mappedSocCode: { not: null },
      },
      select: {
        id: true,
        mappedSocCode: true,
        laborCategoryName: true,
      },
    });
  });

  it('should return the fetched categories', async () => {
    const result = await getCategoriesWithSocCodes(mockRateCardId);

    expect(result).toEqual(mockCategories);
  });

  it('should return empty array when no categories have SOC codes', async () => {
    (db.rateCardCategory.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getCategoriesWithSocCodes(mockRateCardId);

    expect(result).toEqual([]);
  });
});
