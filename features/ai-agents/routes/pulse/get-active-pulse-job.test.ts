import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import getActivePulseJobRoute from './get-active-pulse-job';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import getActivePulseJobDal from '@/features/ai-agents/dal/pulse/getActivePulseJob';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/pulse/getActivePulseJob');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockDal = getActivePulseJobDal as jest.Mock;

const testRouter = router({
  getActivePulseJob: getActivePulseJobRoute,
});

describe('getActivePulseJob route', () => {
  let mockCtx: ContextType;

  const agentId = '11111111-1111-1111-1111-111111111111';
  const input = { agentId };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'user-1',
      logger: console,
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([{ id: agentId, type: AiAgentType.PULSE }]);
    mockDal.mockResolvedValue(null);
  });

  it('returns null when nothing is running', async () => {
    const caller = testRouter.createCaller(mockCtx);
    const result = await caller.getActivePulseJob(input);

    expect(result).toEqual({ job: null });
  });

  it('returns the active job', async () => {
    mockDal.mockResolvedValue({ id: 'job-1', status: 'processing' });

    const caller = testRouter.createCaller(mockCtx);
    const result = await caller.getActivePulseJob(input);

    expect(result.job).toEqual({ id: 'job-1', status: 'processing' });
  });

  it('rejects an agent the user cannot access', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getActivePulseJob(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });

  it('rejects an agent of another type at the same id', async () => {
    mockGetAvailableAgents.mockResolvedValue([{ id: agentId, type: AiAgentType.PRISM }]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getActivePulseJob(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });
});
