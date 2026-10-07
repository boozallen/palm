import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import exportRateCard from './export-rate-card';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { getRateCardForExport } from '@/features/ai-agents/dal/rcast';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/rcast', () => ({
  getRateCardForExport: jest.fn(),
}));

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockGetRateCardForExport = getRateCardForExport as jest.Mock;

const testRouter = router({
  exportRateCard,
});

describe('exportRateCard (rcast)', () => {
  let mockCtx: ContextType;

  const mockInput = {
    aiAgentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    rateCardId: '61b443f9-69ca-42d6-a52f-01eba616705b',
  };

  const mockBlsData = {
    percentile10Annual: 40000,
    percentile25Annual: 50000,
    percentile50Hourly: 30.0,
    percentile75Annual: 70000,
    percentile90Annual: 90000,
  };

  const mockDolData = {
    hourlyPct10: 20.0,
    hourlyPct25: 25.0,
    hourlyMedian: 30.0,
    hourlyPct75: 35.0,
    hourlyPct90: 45.0,
  };

  const mockRateCardData = {
    filename: 'T4NG2_rate_card.xlsx',
    categories: [
      {
        laborCategoryName: 'Data Scientist',
        experienceLevel: 'Senior',
        billRate: 150.0,
        mappedSocCode: '15-2051',
        mappedSocTitle: 'Data Scientists',
        blsSalaryData: mockBlsData,
        dolSalaryData: mockDolData,
      },
      {
        laborCategoryName: 'Software Engineer',
        experienceLevel: 'Junior',
        billRate: 85.0,
        mappedSocCode: '15-1252',
        mappedSocTitle: 'Software Developers',
        blsSalaryData: mockBlsData,
        dolSalaryData: mockDolData,
      },
      {
        laborCategoryName: 'Project Manager',
        experienceLevel: 'Journeyman',
        billRate: 120.0,
        mappedSocCode: '11-9199',
        mappedSocTitle: 'Managers',
        blsSalaryData: mockBlsData,
        dolSalaryData: mockDolData,
      },
      {
        laborCategoryName: 'Technical Lead',
        experienceLevel: 'SME',
        billRate: 200.0,
        mappedSocCode: '15-1299',
        mappedSocTitle: 'Computer Occupations',
        blsSalaryData: mockBlsData,
        dolSalaryData: mockDolData,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.aiAgentId, type: AiAgentType.RCAST },
    ]);
    mockGetRateCardForExport.mockResolvedValue(mockRateCardData);
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.exportRateCard(mockInput)).rejects.toThrow(
      'RCAST-TWO agent not found'
    );

    expect(mockGetRateCardForExport).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.aiAgentId, type: AiAgentType.CERTA },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.exportRateCard(mockInput)).rejects.toThrow(
      'RCAST-TWO agent not found'
    );
  });

  it('should throw if rate card not found', async () => {
    mockGetRateCardForExport.mockResolvedValue(null);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.exportRateCard(mockInput)).rejects.toThrow(
      'Rate card not found'
    );
  });

  it('should return Excel file data with correct filename', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.exportRateCard(mockInput);

    expect(result.filename).toBe('T4NG2_rate_card_analysis.xlsx');
    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(result.data).toBeTruthy();
    expect(() => Buffer.from(result.data, 'base64')).not.toThrow();
  });

  it('should call DAL with correct parameters', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.exportRateCard(mockInput);

    expect(mockGetRateCardForExport).toHaveBeenCalledWith(
      mockInput.rateCardId,
      mockInput.aiAgentId
    );
  });

  it('should handle empty categories', async () => {
    mockGetRateCardForExport.mockResolvedValue({
      filename: 'empty_rate_card.xlsx',
      categories: [],
    });

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.exportRateCard(mockInput);

    expect(result.filename).toBe('empty_rate_card_analysis.xlsx');
    expect(result.data).toBeTruthy();
  });

  it('should handle categories with null wage data', async () => {
    mockGetRateCardForExport.mockResolvedValue({
      filename: 'no_wage_data.xlsx',
      categories: [
        {
          laborCategoryName: 'Test Category',
          experienceLevel: 'Senior',
          billRate: 100.0,
          mappedSocCode: null,
          mappedSocTitle: null,
          blsSalaryData: null,
          dolSalaryData: null,
        },
      ],
    });

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.exportRateCard(mockInput);

    expect(result.filename).toBe('no_wage_data_analysis.xlsx');
    expect(result.data).toBeTruthy();
  });

  it('should handle categories with null bill rate', async () => {
    mockGetRateCardForExport.mockResolvedValue({
      filename: 'null_rate.xlsx',
      categories: [
        {
          laborCategoryName: 'Analyst',
          experienceLevel: 'Junior',
          billRate: null,
          mappedSocCode: null,
          mappedSocTitle: null,
          blsSalaryData: null,
          dolSalaryData: null,
        },
      ],
    });

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.exportRateCard(mockInput);

    expect(result.filename).toBe('null_rate_analysis.xlsx');
    expect(result.data).toBeTruthy();
  });

  it('should generate valid Excel file', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.exportRateCard(mockInput);

    const buffer = Buffer.from(result.data, 'base64');
    expect(buffer.length).toBeGreaterThan(0);

    // Excel files start with PK (zip signature)
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
  });
});
