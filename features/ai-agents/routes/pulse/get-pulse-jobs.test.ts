import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import getPulseJobsRoute from '@/features/ai-agents/routes/pulse/get-pulse-jobs';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import getPulseJobsDal from '@/features/ai-agents/dal/pulse/getPulseJobs';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/pulse/getPulseJobs');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockDal = getPulseJobsDal as jest.Mock;

const testRouter = router({
  getPulseJobs: getPulseJobsRoute,
});

function job(id: string, status: string) {
  return {
    id,
    status,
    surveyFilename: 'symposium.xlsx',
    responseCount: 120,
    createdAt: new Date('2026-09-14T00:00:00Z'),
  };
}

describe('getPulseJobs route', () => {
  let mockCtx: ContextType;

  const agentId = '11111111-1111-1111-1111-111111111111';
  const input = { agentId };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'user-1',
      logger: console,
      errorAuditor: { createErrorRecord: jest.fn() },
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([{ id: agentId, type: AiAgentType.PULSE }]);
    mockDal.mockResolvedValue([]);
  });

  it('returns an empty history for a user who has not run this agent', async () => {
    const result = await testRouter.createCaller(mockCtx).getPulseJobs(input);

    expect(result).toEqual({ jobs: [] });
  });

  it('lists completed and failed runs so a failed run can be opened', async () => {
    mockDal.mockResolvedValue([job('job-2', 'error'), job('job-1', 'completed')]);

    const result = await testRouter.createCaller(mockCtx).getPulseJobs(input);

    expect(result.jobs.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'job-2', status: 'error' },
      { id: 'job-1', status: 'completed' },
    ]);
  });

  it('leaves out runs that have not finished', async () => {
    mockDal.mockResolvedValue([
      job('job-3', 'processing'),
      job('job-2', 'pending'),
      job('job-1', 'completed'),
    ]);

    const result = await testRouter.createCaller(mockCtx).getPulseJobs(input);

    expect(result.jobs.map(({ id }) => id)).toEqual(['job-1']);
  });

  it('reads only the signed-in user\'s runs', async () => {
    await testRouter.createCaller(mockCtx).getPulseJobs(input);

    expect(mockDal).toHaveBeenCalledWith(agentId, 'user-1');
  });

  it('rejects an agent the user cannot access', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    await expect(testRouter.createCaller(mockCtx).getPulseJobs(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });

  it('rejects an agent of another type at the same id', async () => {
    mockGetAvailableAgents.mockResolvedValue([{ id: agentId, type: AiAgentType.PRISM }]);

    await expect(testRouter.createCaller(mockCtx).getPulseJobs(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });
});
