import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import analyzeProposal from './analyze-proposal';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import createPrismJob from '@/features/ai-agents/dal/prism/createPrismJob';
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

jest.mock('@/features/ai-agents/utils/prism/worker/queue', () => ({
  getPrismQueue: () => ({
    add: mockAdd,
  }),
}));

jest.mock('@/server/storage/redis');
jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/prism/createPrismJob');
jest.mock('@/features/shared/dal/isUserGroupMember');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockCreatePrismJob = createPrismJob as jest.Mock;
const mockIsUserGroupMember = isUserGroupMember as jest.Mock;

const testRouter = router({
  analyzeProposal,
});

describe('analyzeProposal', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    requirementsFileKey: 'uploads/requirements.xlsx',
    requirementsFileName: 'requirements.xlsx',
    proposalFileKey: 'uploads/proposal.pdf',
    proposalFileName: 'proposal.pdf',
    proposalContentType: 'application/pdf',
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
      { id: mockInput.agentId, type: AiAgentType.PRISM },
    ]);
    mockCreatePrismJob.mockResolvedValue({});
    mockIsUserGroupMember.mockResolvedValue(true);
    (storage.hset as jest.Mock).mockResolvedValue(1);
    mockAdd.mockResolvedValue({});
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.analyzeProposal(mockInput)).rejects.toThrow(
      'PRISM agent not found or access denied',
    );

    expect(mockCreatePrismJob).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.RCAST },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.analyzeProposal(mockInput)).rejects.toThrow(
      'PRISM agent not found or access denied',
    );
  });

  it('should create a DB job record', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.analyzeProposal(mockInput);

    expect(mockCreatePrismJob).toHaveBeenCalledWith({
      id: 'mock-job-id',
      aiAgentId: mockInput.agentId,
      userId: mockCtx.userId,
      requirementsFilename: mockInput.requirementsFileName,
      proposalFilename: mockInput.proposalFileName,
      userGroupId: null,
    });
  });

  it('should set initial job state in Redis', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.analyzeProposal(mockInput);

    expect(storage.hset).toHaveBeenCalledWith(
      'prism-job:mock-job-id',
      expect.objectContaining({
        status: 'queued',
        progress: 'Job queued, waiting to start...',
      }),
    );
  });

  it('should add job to the queue', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.analyzeProposal(mockInput);

    expect(mockAdd).toHaveBeenCalledWith(
      'prismJob',
      expect.objectContaining({
        jobId: 'mock-job-id',
        userId: mockCtx.userId,
        agentId: mockInput.agentId,
        requirementsFileKey: mockInput.requirementsFileKey,
        proposalFileKey: mockInput.proposalFileKey,
        modelId: mockInput.modelId,
      }),
    );
  });

  it('should return job id and success message', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.analyzeProposal(mockInput);

    expect(result).toEqual({
      jobId: 'mock-job-id',
      message: 'Proposal analysis job queued successfully',
    });
  });

  describe('userGroupId attribution', () => {
    const mockUserGroupId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

    it('should throw if the user is not a member of the requested group', async () => {
      mockIsUserGroupMember.mockResolvedValue(false);

      const caller = testRouter.createCaller(mockCtx);

      await expect(
        caller.analyzeProposal({ ...mockInput, userGroupId: mockUserGroupId }),
      ).rejects.toThrow('You are not a member of the selected group');

      expect(mockCreatePrismJob).not.toHaveBeenCalled();
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it('should persist the validated userGroupId on the job record', async () => {
      const caller = testRouter.createCaller(mockCtx);

      await caller.analyzeProposal({ ...mockInput, userGroupId: mockUserGroupId });

      expect(mockIsUserGroupMember).toHaveBeenCalledWith(mockCtx.userId, mockUserGroupId);
      expect(mockCreatePrismJob).toHaveBeenCalledWith(
        expect.objectContaining({ userGroupId: mockUserGroupId }),
      );
    });

    it('should pass the validated userGroupId on the queued job payload', async () => {
      const caller = testRouter.createCaller(mockCtx);

      await caller.analyzeProposal({ ...mockInput, userGroupId: mockUserGroupId });

      expect(mockAdd).toHaveBeenCalledWith(
        'prismJob',
        expect.objectContaining({ userGroupId: mockUserGroupId }),
      );
    });
  });

  describe('audit', () => {
    it('records a Success AiAgentPrismFormSubmission audit event referencing the job', async () => {
      const caller = testRouter.createCaller(mockCtx);
      await caller.analyzeProposal(mockInput);

      expect(mockCtx.auditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditRecordEvent.AiAgentPrismFormSubmission,
          outcome: AuditRecordOutcome.Success,
          metadata: expect.objectContaining({
            aiAgentId: mockInput.agentId,
            aiAgentJobId: 'mock-job-id',
          }),
        }),
      );
    });

    it('records a Warn AiAgentPrismFormSubmission audit event when the agent is not accessible', async () => {
      mockGetAvailableAgents.mockResolvedValue([]);

      const caller = testRouter.createCaller(mockCtx);
      await expect(caller.analyzeProposal(mockInput)).rejects.toThrow();

      expect(mockCtx.auditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditRecordEvent.AiAgentPrismFormSubmission,
          outcome: AuditRecordOutcome.Warn,
        }),
      );
    });
  });
});
