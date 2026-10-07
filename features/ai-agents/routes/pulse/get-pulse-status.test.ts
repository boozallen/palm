import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import { getPulseStatus } from '@/features/ai-agents/routes/pulse/get-pulse-status';
import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import getPulseJobStatus from '@/features/ai-agents/dal/pulse/getPulseJobStatus';
import { AiAgentType } from '@/features/shared/types';
import {
  formatPulseError,
  stoppedUnexpectedlyError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';

jest.mock('@/server/storage/redis');
jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/pulse/getPulseJobStatus');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockGetPulseJobStatus = getPulseJobStatus as jest.Mock;
const mockStorage = storage as jest.Mocked<typeof storage>;

const testRouter = router({
  getPulseStatus,
});

describe('getPulseStatus', () => {
  let mockCtx: ContextType;

  const agentId = '11111111-1111-1111-1111-111111111111';
  const jobId = '22222222-2222-2222-2222-222222222222';
  const mockInput = { agentId, jobId };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'user-1',
      logger: console,
      errorAuditor: { createErrorRecord: jest.fn() },
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([
      { id: agentId, type: AiAgentType.PULSE },
    ]);
    mockGetPulseJobStatus.mockResolvedValue({
      status: 'completed',
      errorMessage: null,
    });
  });

  it('returns the status from Redis', async () => {
    mockStorage.hgetall.mockResolvedValue({
      status: 'processing',
      progress: '10/50 responses analyzed',
      error: null,
    });

    const caller = testRouter.createCaller(mockCtx);
    const result = await caller.getPulseStatus(mockInput);

    expect(result).toEqual({
      status: 'processing',
      progress: '10/50 responses analyzed',
      error: null,
    });
  });

  it('falls back to persisted status when Redis hash is missing', async () => {
    mockGetPulseJobStatus.mockResolvedValue({
      status: 'completed',
      errorMessage: 'Survey parsing failed',
    });
    mockStorage.hgetall.mockResolvedValue({});

    const caller = testRouter.createCaller(mockCtx);
    const result = await caller.getPulseStatus(mockInput);

    expect(result).toEqual({
      status: 'completed',
      progress: null,
      error: 'Survey parsing failed',
    });
  });

  it('surfaces stored error messages', async () => {
    mockStorage.hgetall.mockResolvedValue({
      status: 'error',
      progress: null,
      error: 'Survey parsing failed',
    });

    const caller = testRouter.createCaller(mockCtx);
    const result = await caller.getPulseStatus(mockInput);

    expect(result).toEqual({
      status: 'error',
      progress: null,
      error: 'Survey parsing failed',
    });
  });

  it('passes a failed run\'s cause and fix through unchanged', async () => {
    const stored = formatPulseError(stoppedUnexpectedlyError());
    mockStorage.hgetall.mockResolvedValue({ status: 'error', progress: null, error: stored });

    const result = await testRouter.createCaller(mockCtx).getPulseStatus(mockInput);

    expect(result.error).toBe(stored);
  });

  it('reports the warning on a run that completed with lost responses', async () => {
    const warning = formatPulseError({
      cause: '1 of 2 responses couldn\'t be analyzed and were filled with their fallback values.',
      fix: 'Check the model is available, then run the survey again for a complete set.',
    });
    mockStorage.hgetall.mockResolvedValue({
      status: 'completed',
      progress: 'Analyzed 2 responses',
      error: warning,
    });

    const result = await testRouter.createCaller(mockCtx).getPulseStatus(mockInput);

    expect(result).toEqual({ status: 'completed', progress: 'Analyzed 2 responses', error: warning });
  });

  it('reports the stored warning once the live status has expired', async () => {
    const warning = formatPulseError({
      cause: '1 of 2 responses couldn\'t be analyzed and were filled with their fallback values.',
      fix: 'Check the model is available, then run the survey again for a complete set.',
    });
    mockGetPulseJobStatus.mockResolvedValue({ status: 'completed', errorMessage: warning });
    mockStorage.hgetall.mockResolvedValue({});

    const result = await testRouter.createCaller(mockCtx).getPulseStatus(mockInput);

    expect(result.error).toBe(warning);
  });

  it('rejects an agent the user cannot access', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPulseStatus(mockInput)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });

  it('rejects an agent of another type at the same id', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: agentId, type: AiAgentType.PRISM },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPulseStatus(mockInput)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });

  it('rejects a job that does not belong to the user', async () => {
    mockGetPulseJobStatus.mockResolvedValue(null);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPulseStatus(mockInput)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'PULSE job not found',
    });
  });

  // Another PULSE agent's run must not be watchable through this agent.
  it('looks the job up under the agent that was asked for', async () => {
    mockStorage.hgetall.mockResolvedValue({});

    await testRouter.createCaller(mockCtx).getPulseStatus(mockInput);

    expect(mockGetPulseJobStatus).toHaveBeenCalledWith(jobId, 'user-1', agentId);
  });
});
