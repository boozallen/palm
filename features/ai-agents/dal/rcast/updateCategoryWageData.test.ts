import db from '@/server/db';
import updateCategoryWageData from './updateCategoryWageData';
import type { BlsWageData, DolWageData } from '@/features/ai-agents/shared/wage-data';

jest.mock('@/server/db', () => ({
  rateCardCategory: {
    update: jest.fn(),
  },
}));

describe('updateCategoryWageData', () => {
  const mockCategoryId = 'category-123';

  const mockBlsData: BlsWageData = {
    socCode: '15-1252',
    meanAnnualWage: 120000,
    meanHourlyWage: 62.5,
    percentile10Annual: 70000,
    percentile25Annual: 90000,
    percentile50Annual: 110000,
    percentile50Hourly: 57.29,
    percentile75Annual: 140000,
    percentile90Annual: 170000,
    dataYear: '2024',
    fetchedAt: '2024-01-15T00:00:00Z',
  };

  const mockDolData: DolWageData = {
    onetCode: '15-1252.00',
    socCode: '15-1252',
    occupationTitle: 'Software Developers',
    hourlyMedian: 58.0,
    hourlyPct10: 35.0,
    hourlyPct25: 45.0,
    hourlyPct75: 72.0,
    hourlyPct90: 85.0,
    annualMedian: 120640,
    annualPct10: 72800,
    annualPct25: 93600,
    annualPct75: 149760,
    annualPct90: 176800,
    location: 'National',
    dataSource: 'DOL',
    dataYear: '2024',
    fetchedAt: '2024-01-15T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    (db.rateCardCategory.update as jest.Mock).mockResolvedValue({
      id: mockCategoryId,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should update category with both BLS and DOL data', async () => {
    await updateCategoryWageData({
      categoryId: mockCategoryId,
      blsData: mockBlsData,
      dolData: mockDolData,
    });

    expect(db.rateCardCategory.update).toHaveBeenCalledWith({
      where: { id: mockCategoryId },
      data: {
        blsSalaryData: mockBlsData,
        dolSalaryData: mockDolData,
        lastSalaryUpdate: new Date('2024-01-15T12:00:00Z'),
      },
    });
  });

  it('should update category with only BLS data when DOL is null', async () => {
    await updateCategoryWageData({
      categoryId: mockCategoryId,
      blsData: mockBlsData,
      dolData: null,
    });

    expect(db.rateCardCategory.update).toHaveBeenCalledWith({
      where: { id: mockCategoryId },
      data: {
        blsSalaryData: mockBlsData,
        dolSalaryData: undefined,
        lastSalaryUpdate: new Date('2024-01-15T12:00:00Z'),
      },
    });
  });

  it('should update category with only DOL data when BLS is null', async () => {
    await updateCategoryWageData({
      categoryId: mockCategoryId,
      blsData: null,
      dolData: mockDolData,
    });

    expect(db.rateCardCategory.update).toHaveBeenCalledWith({
      where: { id: mockCategoryId },
      data: {
        blsSalaryData: undefined,
        dolSalaryData: mockDolData,
        lastSalaryUpdate: new Date('2024-01-15T12:00:00Z'),
      },
    });
  });

  it('should propagate database errors', async () => {
    const dbError = new Error('Database error');
    (db.rateCardCategory.update as jest.Mock).mockRejectedValue(dbError);

    await expect(
      updateCategoryWageData({
        categoryId: mockCategoryId,
        blsData: mockBlsData,
        dolData: mockDolData,
      })
    ).rejects.toThrow('Database error');
  });
});
