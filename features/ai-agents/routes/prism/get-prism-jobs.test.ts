import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import getPrismJobs from './get-prism-jobs';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import getPrismJobsDal from '@/features/ai-agents/dal/prism/getPrismJobs';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/prism/getPrismJobs');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockGetPrismJobs = getPrismJobsDal as jest.Mock;

const testRouter = router({
  getPrismJobs,
});

describe('getPrismJobsRoute', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
  };

  const mockJobs = [
    {
      id: 'job-1',
      status: 'completed',
      requirementsFilename: 'requirements.xlsx',
      proposalFilename: 'proposal.docx',
      createdAt: new Date('2024-01-02'),
    },
    {
      id: 'job-2',
      status: 'completed',
      requirementsFilename: 'requirements-v2.xlsx',
      proposalFilename: 'proposal-v2.docx',
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
      { id: mockInput.agentId, type: AiAgentType.PRISM },
    ]);
    mockGetPrismJobs.mockResolvedValue(mockJobs);
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismJobs(mockInput)).rejects.toThrow(
      'PRISM agent not found or access denied',
    );

    expect(mockGetPrismJobs).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.RCAST },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismJobs(mockInput)).rejects.toThrow(
      'PRISM agent not found or access denied',
    );
  });

  it('should query jobs scoped to agent and user', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.getPrismJobs(mockInput);

    expect(mockGetPrismJobs).toHaveBeenCalledWith(mockInput.agentId, mockCtx.userId);
  });

  it('should return jobs', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getPrismJobs(mockInput);

    expect(result).toEqual({ jobs: mockJobs });
  });

  it('should return empty jobs array when none exist', async () => {
    mockGetPrismJobs.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getPrismJobs(mockInput);

    expect(result).toEqual({ jobs: [] });
  });
});
