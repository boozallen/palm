import db from '@/server/db';
import getRateCardCategoriesForProcessing from './getRateCardCategoriesForProcessing';

jest.mock('@/server/db', () => ({
  rateCardCategory: {
    findMany: jest.fn(),
  },
}));

describe('getRateCardCategoriesForProcessing', () => {
  const mockRateCardId = 'rate-card-123';

  const mockCategories = [
    {
      id: 'category-1',
      laborCategoryName: 'Software Engineer',
      experienceLevel: 'Senior',
      billRate: 150.0,
    },
    {
      id: 'category-2',
      laborCategoryName: 'Data Scientist',
      experienceLevel: 'Mid-Level',
      billRate: 125.0,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (db.rateCardCategory.findMany as jest.Mock).mockResolvedValue(mockCategories);
  });

  it('should fetch categories for the given rate card', async () => {
    await getRateCardCategoriesForProcessing(mockRateCardId);

    expect(db.rateCardCategory.findMany).toHaveBeenCalledWith({
      where: { rateCardId: mockRateCardId },
      select: {
        id: true,
        laborCategoryName: true,
        experienceLevel: true,
        billRate: true,
      },
    });
  });

  it('should return the fetched categories', async () => {
    const result = await getRateCardCategoriesForProcessing(mockRateCardId);

    expect(result).toEqual(mockCategories);
  });

  it('should return empty array when no categories exist', async () => {
    (db.rateCardCategory.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getRateCardCategoriesForProcessing(mockRateCardId);

    expect(result).toEqual([]);
  });

  it('should return categories with null bill rates', async () => {
    const categoriesWithNullRate = [
      { id: 'category-1', laborCategoryName: 'Analyst', experienceLevel: 'Junior', billRate: null },
    ];
    (db.rateCardCategory.findMany as jest.Mock).mockResolvedValue(categoriesWithNullRate);

    const result = await getRateCardCategoriesForProcessing(mockRateCardId);

    expect(result[0].billRate).toBeNull();
  });
});
