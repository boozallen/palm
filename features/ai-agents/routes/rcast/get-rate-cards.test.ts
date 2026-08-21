import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import getRateCards from './get-rate-cards';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/rcast', () => ({
  getRateCardsForAgent: jest.fn(),
}));

import { getRateCardsForAgent } from '@/features/ai-agents/dal/rcast';

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockGetRateCardsForAgent = getRateCardsForAgent as jest.Mock;

const testRouter = router({
  getRateCards,
});

describe('getRateCards (rcast)', () => {
  let mockCtx: ContextType;

  const mockInput = {
    aiAgentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
  };

  const mockRateCards = [
    {
      id: 'rate-card-1',
      filename: 'rate-card-2024.xlsx',
      uploadStatus: 'completed',
      createdAt: new Date('2024-01-02'),
    },
    {
      id: 'rate-card-2',
      filename: 'rate-card-2023.xlsx',
      uploadStatus: 'completed',
      createdAt: new Date('2024-01-01'),
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
    mockGetRateCardsForAgent.mockResolvedValue(mockRateCards);
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getRateCards(mockInput)).rejects.toThrow(
      'RCAST-TWO agent not found'
    );

    expect(mockGetRateCardsForAgent).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.aiAgentId, type: AiAgentType.CERTA },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getRateCards(mockInput)).rejects.toThrow(
      'RCAST-TWO agent not found'
    );
  });

  it('should query rate cards for the agent', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.getRateCards(mockInput);

    expect(mockGetRateCardsForAgent).toHaveBeenCalledWith(mockInput.aiAgentId);
  });

  it('should return rate cards', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getRateCards(mockInput);

    expect(result).toEqual(mockRateCards);
  });

  it('should return empty array when no rate cards exist', async () => {
    mockGetRateCardsForAgent.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getRateCards(mockInput);

    expect(result).toEqual([]);
  });
});
