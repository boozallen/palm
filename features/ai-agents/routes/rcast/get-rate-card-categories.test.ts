import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import getRateCardCategories from './get-rate-card-categories';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/server/db', () => ({
  rateCard: {
    findFirst: jest.fn(),
  },
  rateCardCategory: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/rcast', () => ({
  getRateCardCategoriesForDisplay: jest.fn(),
}));

import { getRateCardCategoriesForDisplay } from '@/features/ai-agents/dal/rcast';

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockGetRateCardCategoriesForDisplay = getRateCardCategoriesForDisplay as jest.Mock;

const testRouter = router({
  getRateCardCategories,
});

describe('getRateCardCategories (rcast)', () => {
  let mockCtx: ContextType;

  const mockInput = {
    aiAgentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    rateCardId: '61b443f9-69ca-42d6-a52f-01eba616705b',
  };

  const mockCategories = [
    {
      id: 'cat-1',
      laborCategoryName: 'Data Scientist',
      experienceLevel: 'Senior',
      billRate: 150.0,
      mappedSocCode: '15-2051',
      mappedSocTitle: 'Data Scientists',
      blsSalaryData: null,
      dolSalaryData: null,
      lastSalaryUpdate: null,
    },
    {
      id: 'cat-2',
      laborCategoryName: 'Software Engineer',
      experienceLevel: 'Mid-Level',
      billRate: 125.0,
      mappedSocCode: null,
      mappedSocTitle: null,
      blsSalaryData: null,
      dolSalaryData: null,
      lastSalaryUpdate: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.aiAgentId, type: AiAgentType.RCAST },
    ]);
    mockGetRateCardCategoriesForDisplay.mockResolvedValue(mockCategories);
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getRateCardCategories(mockInput)).rejects.toThrow(
      'RCAST-TWO agent not found'
    );

    expect(mockGetRateCardCategoriesForDisplay).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.aiAgentId, type: AiAgentType.CERTA },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getRateCardCategories(mockInput)).rejects.toThrow(
      'RCAST-TWO agent not found'
    );
  });

  it('should throw if rate card not found', async () => {
    mockGetRateCardCategoriesForDisplay.mockResolvedValue(null);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getRateCardCategories(mockInput)).rejects.toThrow(
      'Rate card not found'
    );
  });

  it('should call DAL with rateCardId and aiAgentId', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.getRateCardCategories(mockInput);

    expect(mockGetRateCardCategoriesForDisplay).toHaveBeenCalledWith(
      mockInput.rateCardId,
      mockInput.aiAgentId
    );
  });

  it('should return categories', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getRateCardCategories(mockInput);

    expect(result).toEqual(mockCategories);
  });

  it('should return empty array when rate card has no categories', async () => {
    mockGetRateCardCategoriesForDisplay.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getRateCardCategories(mockInput);

    expect(result).toEqual([]);
  });
});
