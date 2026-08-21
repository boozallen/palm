import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import { getPrismStatus } from './get-prism-status';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/server/storage/redis');
jest.mock('@/features/shared/dal/getAvailableAgents');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;

const testRouter = router({
  getPrismStatus,
});

describe('getPrismStatus', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.PRISM },
    ]);
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismStatus(mockInput)).rejects.toThrow(
      'PRISM agent not found or access denied',
    );

    expect(storage.hgetall).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.RCAST },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismStatus(mockInput)).rejects.toThrow(
      'PRISM agent not found or access denied',
    );
  });

  it('should query Redis for job status', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'processing',
      progress: 'Analyzing requirements (2/5)',
    });

    const caller = testRouter.createCaller(mockCtx);

    await caller.getPrismStatus(mockInput);

    expect(storage.hgetall).toHaveBeenCalledWith(`prism-job:${mockInput.jobId}`);
  });

  it('should throw if job not found in Redis', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({});

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismStatus(mockInput)).rejects.toThrow('Job not found');
  });

  it('should throw if Redis returns null', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue(null);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismStatus(mockInput)).rejects.toThrow('Job not found');
  });

  it('should return queued status', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'queued',
      progress: 'Job queued, waiting to start...',
    });

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getPrismStatus(mockInput);

    expect(result).toEqual({
      status: 'queued',
      progress: 'Job queued, waiting to start...',
      error: undefined,
    });
  });

  it('should return processing status with progress', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'processing',
      progress: 'Analyzing requirements (3/5)',
    });

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getPrismStatus(mockInput);

    expect(result).toEqual({
      status: 'processing',
      progress: 'Analyzing requirements (3/5)',
      error: undefined,
    });
  });

  it('should return completed status', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'completed',
      progress: 'Analysis complete',
    });

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getPrismStatus(mockInput);

    expect(result).toEqual({
      status: 'completed',
      progress: 'Analysis complete',
      error: undefined,
    });
  });

  it('should return error status with error message', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'error',
      progress: 'Failed',
      error: 'Failed to process document',
    });

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getPrismStatus(mockInput);

    expect(result).toEqual({
      status: 'error',
      progress: 'Failed',
      error: 'Failed to process document',
    });
  });
});
