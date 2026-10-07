import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import startOdramAnalysis from './start-odram-analysis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import createOdramJob from '@/features/ai-agents/dal/odram/createOdramJob';
import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';
import { AiAgentType } from '@/features/shared/types';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
} from '@/features/shared/types/audit-record';

jest.mock('uuid', () => {
  const actualUuid = jest.requireActual('uuid');
  return {
    ...actualUuid,
    v4: jest.fn().mockReturnValue('mock-job-id'),
  };
});

const mockAdd = jest.fn();

jest.mock('@/features/ai-agents/utils/odram/worker/queue', () => ({
  getOdramQueue: () => ({
    add: mockAdd,
  }),
}));

jest.mock('@/server/storage/redis');
jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/odram/createOdramJob');
jest.mock('@/features/shared/dal/isUserGroupMember');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockCreateOdramJob = createOdramJob as jest.Mock;
const mockIsUserGroupMember = isUserGroupMember as jest.Mock;

const testRouter = router({
  startOdramAnalysis,
});

describe('startOdramAnalysis', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    promptMatrixFileKey: 'uploads/matrix.xlsx',
    promptMatrixFileName: 'matrix.xlsx',
    promptMatrixContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    odramFileKey: 'uploads/odram.pdf',
    odramFileName: 'odram.pdf',
    odramContentType: 'application/pdf',
    proposalFiles: [
      { fileKey: 'uploads/proposal.pdf', fileName: 'proposal.pdf', contentType: 'application/pdf' },
    ],
    documentUploadProviderId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
      auditor: { createAuditRecord: jest.fn() },
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.ODRAM },
    ]);
    mockCreateOdramJob.mockResolvedValue({});
    (storage.hset as jest.Mock).mockResolvedValue(1);
    mockAdd.mockResolvedValue({});
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startOdramAnalysis(mockInput)).rejects.toThrow(
      'ODRAM agent not found or access denied',
    );

    expect(mockCreateOdramJob).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.PRISM },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startOdramAnalysis(mockInput)).rejects.toThrow(
      'ODRAM agent not found or access denied',
    );
  });

  it('should create a DB job record with a null userGroupId by default', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.startOdramAnalysis(mockInput);

    expect(mockCreateOdramJob).toHaveBeenCalledWith({
      id: 'mock-job-id',
      aiAgentId: mockInput.agentId,
      userId: mockCtx.userId,
      odramFilename: mockInput.odramFileName,
      userGroupId: null,
    });
  });

  it('should set initial job state in Redis', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.startOdramAnalysis(mockInput);

    expect(storage.hset).toHaveBeenCalledWith(
      'odram-job:mock-job-id',
      expect.objectContaining({
        status: 'queued',
        progress: 'Job queued, waiting to start...',
      }),
    );
  });

  it('should add job to the queue', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.startOdramAnalysis(mockInput);

    expect(mockAdd).toHaveBeenCalledWith(
      'odramJob',
      expect.objectContaining({
        jobId: 'mock-job-id',
        userId: mockCtx.userId,
        agentId: mockInput.agentId,
        odramFileKey: mockInput.odramFileKey,
        modelId: mockInput.modelId,
        userGroupId: null,
      }),
    );
  });

  it('should return job id and success message', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.startOdramAnalysis(mockInput);

    expect(result).toEqual({
      jobId: 'mock-job-id',
      message: 'ODRAM analysis job queued successfully',
    });
  });

  it('attributes the job to the selected group when the user is a member', async () => {
    const mockUserGroupId = 'e1b2c3d4-e5f6-7890-abcd-ef1234567891';
    mockIsUserGroupMember.mockResolvedValue(true);

    const caller = testRouter.createCaller(mockCtx);
    await caller.startOdramAnalysis({ ...mockInput, userGroupId: mockUserGroupId });

    expect(mockIsUserGroupMember).toHaveBeenCalledWith(mockCtx.userId, mockUserGroupId);
    expect(mockCreateOdramJob).toHaveBeenCalledWith(
      expect.objectContaining({ userGroupId: mockUserGroupId }),
    );
    expect(mockAdd).toHaveBeenCalledWith(
      'odramJob',
      expect.objectContaining({ userGroupId: mockUserGroupId }),
    );
  });

  it('rejects a selected group the user is not a member of', async () => {
    const mockUserGroupId = 'e1b2c3d4-e5f6-7890-abcd-ef1234567891';
    mockIsUserGroupMember.mockResolvedValue(false);

    const caller = testRouter.createCaller(mockCtx);

    await expect(
      caller.startOdramAnalysis({ ...mockInput, userGroupId: mockUserGroupId }),
    ).rejects.toThrow('You are not a member of the selected group');

    expect(mockIsUserGroupMember).toHaveBeenCalledWith(mockCtx.userId, mockUserGroupId);
    expect(mockCreateOdramJob).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  describe('audit', () => {
    it('records a Success AiAgentOdramFormSubmission audit event referencing the job', async () => {
      const caller = testRouter.createCaller(mockCtx);
      await caller.startOdramAnalysis(mockInput);

      expect(mockCtx.auditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditRecordEvent.AiAgentOdramFormSubmission,
          outcome: AuditRecordOutcome.Success,
          metadata: expect.objectContaining({
            aiAgentId: mockInput.agentId,
            aiAgentJobId: 'mock-job-id',
          }),
        }),
      );
    });

    it('records a Warn AiAgentOdramFormSubmission audit event when the agent is not accessible', async () => {
      mockGetAvailableAgents.mockResolvedValue([]);

      const caller = testRouter.createCaller(mockCtx);
      await expect(caller.startOdramAnalysis(mockInput)).rejects.toThrow();

      expect(mockCtx.auditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditRecordEvent.AiAgentOdramFormSubmission,
          outcome: AuditRecordOutcome.Warn,
        }),
      );
    });
  });
});
