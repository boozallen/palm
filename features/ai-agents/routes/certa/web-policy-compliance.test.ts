import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import {
  webPolicyCompliance,
  getComplianceStatus,
} from './web-policy-compliance';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AgentType } from '@/features/shared/types';

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-job-id'),
}));
jest.mock('@/server/storage/redis');
const mockAdd = jest.fn();

jest.mock('@/features/ai-agents/utils/certa/complianceQueue', () => ({
  getComplianceQueue: () => ({
    add: mockAdd,
  }),
}));

jest.mock('@/features/ai-agents/utils/certa/complianceWorker', () => ({
  startWorker: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('@/features/shared/dal/getAvailableAgents');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;

const testRouter = router({
  webPolicyCompliance,
  getComplianceStatus,
});

describe('webPolicyCompliance route', () => {
  let mockCtx: ContextType;

  const mockInput = {
    url: 'https://test.gov',
    model: '123e4567-e89b-12d3-a456-426614174000',
    policies: [
      { title: 'Policy 1', content: 'Content 1', requirements: 'Requirement 1' },
      { title: 'Policy 2', content: 'Content 2', requirements: 'Requirement 2' },
    ],
    instructions: 'Some instructions',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([
      { name: AgentType.CERTA },
    ]);
  });

  it('should generate a jobId', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.webPolicyCompliance(mockInput);

    expect(result).toEqual({ jobId: 'mock-job-id' });
  });

  it('should set job status in Redis', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.webPolicyCompliance(mockInput);

    expect(storage.hset).toHaveBeenCalledWith('job:mock-job-id', {
      status: 'processing',
      url: mockInput.url,
      created: expect.any(Number),
    });
  });

  it('should add job to compliance queue', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.webPolicyCompliance(mockInput);

    expect(mockAdd).toHaveBeenCalledWith('complianceJob', {
      ...mockInput,
      jobId: 'mock-job-id',
      userId: mockCtx.userId,
    });
  });

  it('should throw error if agent is not available to user', async() => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.webPolicyCompliance(mockInput)).rejects.toThrow(
      'You do not have permission to access this resource'
    );

    expect(storage.hset).not.toHaveBeenCalled();
  });
});

describe('getComplianceStatus', () => {
  const jobId = 'test-job-id';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableAgents.mockResolvedValue([
      { name: AgentType.CERTA },
    ]);
  });

  it('should retrieve job status from Redis', async () => {
    const mockJob = {
      status: 'completed',
      url: 'https://example.com',
      created: '1234567890',
      error: null,
      results: JSON.stringify({ key: 'value' }),
      partialResults: JSON.stringify({ partial: 'data' }),
    };

    (storage.hgetall as jest.Mock).mockResolvedValue(mockJob);

    const caller = testRouter.createCaller({} as ContextType);

    const result = await caller.getComplianceStatus({ jobId });

    expect(result).toEqual({
      ...mockJob,
      results: { key: 'value' },
      partialResults: { partial: 'data' },
    });
  });

  it('should throw an error if job is not found', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({});

    const caller = testRouter.createCaller({} as ContextType);

    await expect(caller.getComplianceStatus({ jobId })).rejects.toThrow('Job not found');
  });

  it('show throw error if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller({} as ContextType);

    await expect(caller.getComplianceStatus({ jobId })).rejects.toThrow(
      'You do not have permission to access this resource'
    );

    expect(storage.hgetall).not.toHaveBeenCalled();
  });
});
