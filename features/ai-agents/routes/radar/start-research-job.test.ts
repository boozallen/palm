import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import { startResearchJob } from './start-research-job';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';
import { AiAgentType } from '@/features/shared/types';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
} from '@/features/shared/types/audit-record';

jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');
  return {
    ...actualCrypto,
    randomUUID: jest.fn().mockReturnValue('mock-research-job-id'),
  };
});

jest.mock('@/server/storage/redis');

const mockAdd = jest.fn();

jest.mock('@/features/ai-agents/utils/radar/worker/queue', () => ({
  getRadarQueue: () => ({
    add: mockAdd,
  }),
}));

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/shared/dal/isUserGroupMember');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockIsUserGroupMember = isUserGroupMember as jest.Mock;

const testRouter = router({
  startResearchJob,
});

describe('startResearchJob', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    dateStart: '2024-01-01',
    dateEnd: '2024-12-31',
    model: '123e4567-e89b-12d3-a456-426614174000',
    categories: ['Machine Learning', 'Computer Science'],
    institutions: ['Stanford University', 'MIT'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
      auditor: { createAuditRecord: jest.fn() },
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([{ id: mockInput.agentId, type: AiAgentType.RADAR }]);
    mockIsUserGroupMember.mockResolvedValue(true);
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startResearchJob(mockInput)).rejects.toThrow(
      'You do not have permission to access this resource.'
    );

    expect(storage.hset).not.toHaveBeenCalled();
  });

  it('should generate a jobId', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.startResearchJob(mockInput);

    expect(result).toEqual({ jobId: 'mock-research-job-id' });
  });

  it('should set job status in Redis', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.startResearchJob(mockInput);

    expect(storage.hset).toHaveBeenCalledWith(
      'radar-job:mock-research-job-id',
      {
        status: 'processing',
        created: expect.any(Number),
        progress: 'Initializing research...',
        searchHash: expect.any(String),
      }
    );
  });

  it('should add job to research queue', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.startResearchJob(mockInput);

    expect(mockAdd).toHaveBeenCalledWith('researchJob', {
      ...mockInput,
      jobId: 'mock-research-job-id',
      userId: mockCtx.userId,
      searchHash: expect.any(String),
      userGroupId: null,
    });
  });

  it('should validate and include userGroupId in the queued job when provided', async () => {
    const mockUserGroupId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const caller = testRouter.createCaller(mockCtx);

    await caller.startResearchJob({ ...mockInput, userGroupId: mockUserGroupId });

    expect(mockIsUserGroupMember).toHaveBeenCalledWith(mockCtx.userId, mockUserGroupId);
    expect(mockAdd).toHaveBeenCalledWith('researchJob', {
      ...mockInput,
      userGroupId: mockUserGroupId,
      jobId: 'mock-research-job-id',
      userId: mockCtx.userId,
      searchHash: expect.any(String),
    });
  });

  it('should throw if the user is not a member of the selected group', async () => {
    mockIsUserGroupMember.mockResolvedValue(false);
    const mockUserGroupId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const caller = testRouter.createCaller(mockCtx);

    await expect(
      caller.startResearchJob({ ...mockInput, userGroupId: mockUserGroupId })
    ).rejects.toThrow('You are not a member of the selected group');

    expect(mockAdd).not.toHaveBeenCalled();
  });

  describe('audit', () => {
    it('records a Success AiAgentRadarFormSubmission audit event referencing the job', async () => {
      const caller = testRouter.createCaller(mockCtx);
      await caller.startResearchJob(mockInput);

      expect(mockCtx.auditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditRecordEvent.AiAgentRadarFormSubmission,
          outcome: AuditRecordOutcome.Success,
          metadata: expect.objectContaining({
            aiAgentId: mockInput.agentId,
            aiAgentJobId: 'mock-research-job-id',
          }),
        }),
      );
    });

    it('records a Warn AiAgentRadarFormSubmission audit event when the agent is not accessible', async () => {
      mockGetAvailableAgents.mockResolvedValue([]);

      const caller = testRouter.createCaller(mockCtx);
      await expect(caller.startResearchJob(mockInput)).rejects.toThrow();

      expect(mockCtx.auditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditRecordEvent.AiAgentRadarFormSubmission,
          outcome: AuditRecordOutcome.Warn,
        }),
      );
    });
  });
});
