import db from '@/server/db';
import updateCategorySocMapping from './updateCategorySocMapping';

jest.mock('@/server/db', () => ({
  rateCardCategory: {
    update: jest.fn(),
  },
}));

describe('updateCategorySocMapping', () => {
  const mockInput = {
    categoryId: 'category-123',
    socCode: '15-1252.00',
    socTitle: 'Software Developers',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.rateCardCategory.update as jest.Mock).mockResolvedValue({
      id: mockInput.categoryId,
      mappedSocCode: mockInput.socCode,
      mappedSocTitle: mockInput.socTitle,
    });
  });

  it('should update the category with SOC code and title', async () => {
    await updateCategorySocMapping(mockInput);

    expect(db.rateCardCategory.update).toHaveBeenCalledWith({
      where: { id: mockInput.categoryId },
      data: {
        mappedSocCode: mockInput.socCode,
        mappedSocTitle: mockInput.socTitle,
      },
    });
  });

  it('should not throw on successful update', async () => {
    await expect(updateCategorySocMapping(mockInput)).resolves.not.toThrow();
  });

  it('should propagate database errors', async () => {
    const dbError = new Error('Database error');
    (db.rateCardCategory.update as jest.Mock).mockRejectedValue(dbError);

    await expect(updateCategorySocMapping(mockInput)).rejects.toThrow('Database error');
  });
});
