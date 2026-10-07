import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import analyzeWarrant from './analyze-warrant';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';
import { getSwearQueue } from '@/features/ai-agents/utils/swear/worker/queue';
import { parseFile } from '@/features/document-upload-provider/sources/utils/file-helpers';
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

jest.mock('@/features/ai-agents/utils/swear/worker/queue');
jest.mock('@/server/storage/redis');
jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/shared/dal/isUserGroupMember');
jest.mock('@/features/document-upload-provider/sources/utils/file-helpers');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockIsUserGroupMember = isUserGroupMember as jest.Mock;
const mockGetSwearQueue = getSwearQueue as jest.Mock;
const mockParseFile = parseFile as jest.Mock;

const testRouter = router({
  analyzeWarrant,
});

describe('analyzeWarrant', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    fileContent: Buffer.from('warrant content').toString('base64'),
    fileName: 'warrant.pdf',
    contentType: 'application/pdf',
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
      { id: mockInput.agentId, type: AiAgentType.SWEAR },
    ]);
    mockParseFile.mockResolvedValue('Extracted document text content');
    mockGetSwearQueue.mockReturnValue({ add: mockAdd });
    (storage.hset as jest.Mock).mockResolvedValue(1);
    mockAdd.mockResolvedValue({});
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.analyzeWarrant(mockInput)).rejects.toThrow(
      'SWEAR agent not found or access denied',
    );

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.PRISM },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.analyzeWarrant(mockInput)).rejects.toThrow(
      'SWEAR agent not found or access denied',
    );
  });

  it('should set initial job state in Redis', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.analyzeWarrant(mockInput);

    expect(storage.hset).toHaveBeenCalledWith(
      'swear-job:mock-job-id',
      expect.objectContaining({
        status: 'queued',
        progress: 'Job queued, waiting to start...',
      }),
    );
  });

  it('should add job to the queue with a null userGroupId by default', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.analyzeWarrant(mockInput);

    expect(mockAdd).toHaveBeenCalledWith(
      'swearJob',
      expect.objectContaining({
        jobId: 'mock-job-id',
        userId: mockCtx.userId,
        agentId: mockInput.agentId,
        modelId: mockInput.modelId,
        filename: mockInput.fileName,
        userGroupId: null,
      }),
    );
  });

  it('should return job id and success message', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.analyzeWarrant(mockInput);

    expect(result).toEqual({
      jobId: 'mock-job-id',
      message: 'Warrant analysis job queued successfully',
    });
  });

  it('attributes the job to the selected group when the user is a member', async () => {
    const mockUserGroupId = 'e1b2c3d4-e5f6-7890-abcd-ef1234567891';
    mockIsUserGroupMember.mockResolvedValue(true);

    const caller = testRouter.createCaller(mockCtx);
    await caller.analyzeWarrant({ ...mockInput, userGroupId: mockUserGroupId });

    expect(mockIsUserGroupMember).toHaveBeenCalledWith(mockCtx.userId, mockUserGroupId);
    expect(mockAdd).toHaveBeenCalledWith(
      'swearJob',
      expect.objectContaining({ userGroupId: mockUserGroupId }),
    );
  });

  it('rejects a selected group the user is not a member of', async () => {
    const mockUserGroupId = 'e1b2c3d4-e5f6-7890-abcd-ef1234567891';
    mockIsUserGroupMember.mockResolvedValue(false);

    const caller = testRouter.createCaller(mockCtx);

    await expect(
      caller.analyzeWarrant({ ...mockInput, userGroupId: mockUserGroupId }),
    ).rejects.toThrow('You are not a member of the selected group');

    expect(mockIsUserGroupMember).toHaveBeenCalledWith(mockCtx.userId, mockUserGroupId);
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockParseFile).not.toHaveBeenCalled();
  });

  it('should throw when parseFile fails', async () => {
    mockParseFile.mockRejectedValue(new Error('Parse error'));

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.analyzeWarrant(mockInput)).rejects.toThrow(
      'Failed to parse warrant document. Please ensure it is a valid PDF or DOCX file.',
    );

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('should throw when no text can be extracted from the document', async () => {
    mockParseFile.mockResolvedValue('   ');

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.analyzeWarrant(mockInput)).rejects.toThrow(
      'No text could be extracted from the document. Please ensure it contains readable text.',
    );

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('should throw when the queue is not available', async () => {
    mockGetSwearQueue.mockReturnValue(null);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.analyzeWarrant(mockInput)).rejects.toThrow(
      'SWEAR job queue not available',
    );
  });

  describe('audit', () => {
    it('records a Success AiAgentSwearFormSubmission audit event referencing the job', async () => {
      const caller = testRouter.createCaller(mockCtx);
      await caller.analyzeWarrant(mockInput);

      expect(mockCtx.auditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditRecordEvent.AiAgentSwearFormSubmission,
          outcome: AuditRecordOutcome.Success,
          metadata: expect.objectContaining({
            aiAgentId: mockInput.agentId,
            aiAgentJobId: 'mock-job-id',
          }),
        }),
      );
    });

    it('records a Warn AiAgentSwearFormSubmission audit event when the agent is not accessible', async () => {
      mockGetAvailableAgents.mockResolvedValue([]);

      const caller = testRouter.createCaller(mockCtx);
      await expect(caller.analyzeWarrant(mockInput)).rejects.toThrow();

      expect(mockCtx.auditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditRecordEvent.AiAgentSwearFormSubmission,
          outcome: AuditRecordOutcome.Warn,
        }),
      );
    });
  });
});
