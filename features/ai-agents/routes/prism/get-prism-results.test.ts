import db from '@/server/db';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import getPrismResults from './get-prism-results';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import getPrismResultsDal from '@/features/ai-agents/dal/prism/getPrismResults';
import { AiAgentType } from '@/features/shared/types';
import { ComplianceStatus } from '@/features/ai-agents/types/prism/complianceResult';

jest.mock('@/server/db', () => ({
  agentPrismJob: {
    findFirst: jest.fn(),
  },
}));

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/prism/getPrismResults');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockGetPrismResults = getPrismResultsDal as jest.Mock;

const testRouter = router({
  getPrismResults,
});

describe('getPrismResultsRoute', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  };

  const mockJob = {
    id: mockInput.jobId,
    userId: 'test-user-id',
  };

  const mockResults = [
    {
      id: 'result-1',
      jobId: mockInput.jobId,
      category: 'Technical',
      requirement: 'The system shall support 1,000 concurrent users.',
      complianceStatus: ComplianceStatus.YES,
      reasoning: 'Proposal addresses this requirement.',
      citations: 'Our platform supports up to 5,000 concurrent users.',
      sortOrder: 0,
    },
    {
      id: 'result-2',
      jobId: mockInput.jobId,
      category: 'Technical',
      requirement: 'All data shall be encrypted using TLS 1.2 or higher.',
      complianceStatus: ComplianceStatus.YES,
      reasoning: 'TLS 1.3 is mentioned in the proposal.',
      citations: 'All communications are encrypted using TLS 1.3.',
      sortOrder: 1,
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
    (db.agentPrismJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
    mockGetPrismResults.mockResolvedValue(mockResults);
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismResults(mockInput)).rejects.toThrow(
      'PRISM agent not found or access denied',
    );

    expect(db.agentPrismJob.findFirst).not.toHaveBeenCalled();
    expect(mockGetPrismResults).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.RCAST },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismResults(mockInput)).rejects.toThrow(
      'PRISM agent not found or access denied',
    );
  });

  it('should verify job belongs to the requesting user', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.getPrismResults(mockInput);

    expect(db.agentPrismJob.findFirst).toHaveBeenCalledWith({
      where: { id: mockInput.jobId, userId: mockCtx.userId },
    });
  });

  it('should throw if job does not belong to user', async () => {
    (db.agentPrismJob.findFirst as jest.Mock).mockResolvedValue(null);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismResults(mockInput)).rejects.toThrow(
      'Job not found or access denied',
    );

    expect(mockGetPrismResults).not.toHaveBeenCalled();
  });

  it('should fetch results for the job', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.getPrismResults(mockInput);

    expect(mockGetPrismResults).toHaveBeenCalledWith(mockInput.jobId);
  });

  it('should return results', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getPrismResults(mockInput);

    expect(result).toEqual({ results: mockResults });
  });

  it('should return empty results when job has none', async () => {
    mockGetPrismResults.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getPrismResults(mockInput);

    expect(result).toEqual({ results: [] });
  });
});
