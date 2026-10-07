import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import {
  webPolicyCompliance,
  getComplianceStatus,
} from './web-policy-compliance';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
} from '@/features/shared/types/audit-record';

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-job-id'),
}));
jest.mock('@/server/storage/redis');
const mockAdd = jest.fn();

jest.mock('@/features/ai-agents/utils/certa/worker/queue', () => ({
  getCertaQueue: () => ({
    add: mockAdd,
  }),
}));

jest.mock('@/features/ai-agents/utils/certa/worker/worker', () => ({
  startCertaWorker: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/shared/dal/isUserGroupMember');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockIsUserGroupMember = isUserGroupMember as jest.Mock;

const testRouter = router({
  webPolicyCompliance,
  getComplianceStatus,
});

describe('webPolicyCompliance route', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: 'dc1686a0-bd0f-4cf1-b7e0-08a733570af4',
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
      auditor: { createAuditRecord: jest.fn() },
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.CERTA },
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

    expect(storage.hset).toHaveBeenCalledWith('certa-job:mock-job-id', {
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
      userGroupId: null,
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

  it('should validate and pass the userGroupId to the queue when the user is a member', async () => {
    const mockUserGroupId = '5e8b1c1a-2f3e-4b3a-8b1a-2f3e4b3a8b1a';
    mockIsUserGroupMember.mockResolvedValue(true);

    const caller = testRouter.createCaller(mockCtx);

    await caller.webPolicyCompliance({ ...mockInput, userGroupId: mockUserGroupId });

    expect(mockIsUserGroupMember).toHaveBeenCalledWith(mockCtx.userId, mockUserGroupId);
    expect(mockAdd).toHaveBeenCalledWith('complianceJob', {
      ...mockInput,
      jobId: 'mock-job-id',
      userId: mockCtx.userId,
      userGroupId: mockUserGroupId,
    });
  });

  it('should throw an error if the user is not a member of the selected group', async () => {
    const mockUserGroupId = '5e8b1c1a-2f3e-4b3a-8b1a-2f3e4b3a8b1a';
    mockIsUserGroupMember.mockResolvedValue(false);

    const caller = testRouter.createCaller(mockCtx);

    await expect(
      caller.webPolicyCompliance({ ...mockInput, userGroupId: mockUserGroupId })
    ).rejects.toThrow('You are not a member of the selected group');

    expect(mockAdd).not.toHaveBeenCalled();
  });

  describe('audit', () => {
    it('records a Success AiAgentCertaFormSubmission audit event referencing the job', async () => {
      const caller = testRouter.createCaller(mockCtx);
      await caller.webPolicyCompliance(mockInput);

      expect(mockCtx.auditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditRecordEvent.AiAgentCertaFormSubmission,
          outcome: AuditRecordOutcome.Success,
          metadata: expect.objectContaining({
            aiAgentId: mockInput.agentId,
            aiAgentJobId: 'mock-job-id',
          }),
        }),
      );
    });

    it('records a Warn AiAgentCertaFormSubmission audit event when the agent is not accessible', async () => {
      mockGetAvailableAgents.mockResolvedValue([]);

      const caller = testRouter.createCaller(mockCtx);
      await expect(caller.webPolicyCompliance(mockInput)).rejects.toThrow();

      expect(mockCtx.auditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditRecordEvent.AiAgentCertaFormSubmission,
          outcome: AuditRecordOutcome.Warn,
        }),
      );
    });
  });
});

describe('getComplianceStatus', () => {
  const jobId = 'test-job-id';
  const agentId = 'dc1686a0-bd0f-4cf1-b7e0-08a733570af4';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableAgents.mockResolvedValue([
      { id: agentId, type: AiAgentType.CERTA },
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

    const result = await caller.getComplianceStatus({ agentId, jobId });

    expect(result).toEqual({
      ...mockJob,
      results: { key: 'value' },
      partialResults: { partial: 'data' },
    });
  });

  it('should throw an error if job is not found', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({});

    const caller = testRouter.createCaller({} as ContextType);

    await expect(caller.getComplianceStatus({ agentId, jobId })).rejects.toThrow('Job not found');
  });

  it('show throw error if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller({} as ContextType);

    await expect(caller.getComplianceStatus({ agentId, jobId })).rejects.toThrow(
      'You do not have permission to access this resource'
    );

    expect(storage.hgetall).not.toHaveBeenCalled();
  });
});
