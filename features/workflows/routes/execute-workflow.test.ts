import { router } from '@/server/trpc';
import { executeWorkflow } from '@/features/workflows/routes/execute-workflow';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import getWorkflowForExecution from '@/features/workflows/dal/getWorkflowForExecution';
import createWorkflowExecution from '@/features/workflows/dal/createWorkflowExecution';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';
import { PrimitiveType } from '@/features/workflows/types/primitive';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

jest.mock('@/features/workflows/dal/getWorkflowForExecution');
jest.mock('@/features/workflows/dal/createWorkflowExecution');
jest.mock('@/features/shared/dal/getUserWorkflowsAccess');
jest.mock('@/features/shared/dal/isUserGroupMember');
jest.mock('@/features/workflows/utils/sanitize', () => ({
  sanitizeForPostgres: jest.fn((v) => v),
}));
jest.mock('@/features/workflows/utils/worker/queue', () => ({
  getWorkflowQueue: jest.fn(() => ({
    add: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('@/features/workflows/utils/workflow-conversion', () => ({
  graphToWorkflow: jest.fn(),
}));

const workflowsRouter = router({ executeWorkflow });

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockExecutionId = '550e8400-e29b-41d4-a716-446655440020';

const mockWorkflow = {
  id: mockWorkflowId,
  createdBy: mockUserId,
  deletedAt: null,
  definition: {
    primitives: [
      {
        id: 'prim-1',
        type: PrimitiveType.WEBSCRAPER,
        name: 'Scraper',
        config: { url: 'https://example.com' },
      },
    ],
  },
  userGroups: [],
};

const mockExecution = {
  id: mockExecutionId,
  status: 'pending',
};

describe('executeWorkflow route', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      auditor: {
        createAuditRecord: jest.fn(),
      },
    } as unknown as ContextType;

    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(true);
    (getWorkflowForExecution as jest.Mock).mockResolvedValue(mockWorkflow);
    (createWorkflowExecution as jest.Mock).mockResolvedValue(mockExecution);
  });

  it('should start a workflow execution and return the execution id', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.executeWorkflow({ workflowId: mockWorkflowId });

    expect(getUserWorkflowsAccess).toHaveBeenCalledWith(mockUserId);
    expect(getWorkflowForExecution).toHaveBeenCalledWith(mockWorkflowId, mockUserId);
    expect(createWorkflowExecution).toHaveBeenCalled();
    expect(result).toMatchObject({
      executionId: mockExecutionId,
      status: 'pending',
      message: 'Workflow execution started',
    });
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Success,
        event: AuditRecordEvent.WorkflowExecutionFormSubmission,
        metadata: expect.objectContaining({
          workflowId: mockWorkflowId,
          workflowExecutionId: mockExecutionId,
        }),
      }),
    );
  });

  it('should queue the job with raw promptId without resolving prompt text upfront', async () => {
    const promptId = '550e8400-e29b-41d4-a716-446655440010';
    const { getWorkflowQueue } = require('@/features/workflows/utils/worker/queue');
    const mockAdd = jest.fn().mockResolvedValue(undefined);
    getWorkflowQueue.mockReturnValue({ add: mockAdd });

    (getWorkflowForExecution as jest.Mock).mockResolvedValue({
      ...mockWorkflow,
      definition: {
        primitives: [
          {
            id: 'p-llm',
            type: PrimitiveType.PROMPT,
            name: 'LLM',
            config: { model: 'claude', promptId },
          },
        ],
      },
    });

    const caller = workflowsRouter.createCaller(ctx);
    await caller.executeWorkflow({ workflowId: mockWorkflowId });

    const jobData = mockAdd.mock.calls[0][1];
    const llmPrimitive = jobData.primitives.find((p: any) => p.type === PrimitiveType.PROMPT);
    expect(llmPrimitive.config.promptId).toBe(promptId);
    expect(llmPrimitive.config.prompt).toBeUndefined();
  });

  it('should throw if user does not have workflows access', async () => {
    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(false);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.executeWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You do not have access to workflows');

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.WorkflowExecutionFormSubmission,
      }),
    );
  });

  it('should throw if workflow is not found', async () => {
    (getWorkflowForExecution as jest.Mock).mockResolvedValue(null);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.executeWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('Workflow not found');

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.WorkflowExecutionFormSubmission,
      }),
    );
  });

  it('should throw if user does not own the workflow and has no group access', async () => {
    (getWorkflowForExecution as jest.Mock).mockResolvedValue({
      ...mockWorkflow,
      createdBy: 'another-user-id',
    });

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.executeWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You do not have permission to execute this workflow');

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.WorkflowExecutionFormSubmission,
      }),
    );
  });

  it('attributes the execution to the selected group when the user is a member', async () => {
    const mockUserGroupId = '550e8400-e29b-41d4-a716-446655440030';
    (isUserGroupMember as jest.Mock).mockResolvedValue(true);
    const { getWorkflowQueue } = require('@/features/workflows/utils/worker/queue');
    const mockAdd = jest.fn().mockResolvedValue(undefined);
    getWorkflowQueue.mockReturnValue({ add: mockAdd });

    const caller = workflowsRouter.createCaller(ctx);
    await caller.executeWorkflow({ workflowId: mockWorkflowId, userGroupId: mockUserGroupId });

    expect(isUserGroupMember).toHaveBeenCalledWith(mockUserId, mockUserGroupId);
    expect(createWorkflowExecution).toHaveBeenCalledWith(
      expect.anything(),
      mockWorkflowId,
      mockUserId,
      expect.anything(),
      mockUserGroupId,
    );
    expect(mockAdd).toHaveBeenCalledWith('workflowExecution', expect.objectContaining({ userGroupId: mockUserGroupId }));
  });

  it('rejects a selected group the user is not a member of', async () => {
    const mockUserGroupId = '550e8400-e29b-41d4-a716-446655440030';
    (isUserGroupMember as jest.Mock).mockResolvedValue(false);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.executeWorkflow({ workflowId: mockWorkflowId, userGroupId: mockUserGroupId }),
    ).rejects.toThrow('You are not a member of the selected group');

    expect(createWorkflowExecution).not.toHaveBeenCalled();
  });

  it('attributes the execution to the pinned group without asking the client', async () => {
    (getWorkflowForExecution as jest.Mock).mockResolvedValue({
      ...mockWorkflow,
      pinnedUserGroupId: 'pinned-group-1',
    });
    const { getWorkflowQueue } = require('@/features/workflows/utils/worker/queue');
    const mockAdd = jest.fn().mockResolvedValue(undefined);
    getWorkflowQueue.mockReturnValue({ add: mockAdd });

    const caller = workflowsRouter.createCaller(ctx);
    await caller.executeWorkflow({ workflowId: mockWorkflowId });

    expect(isUserGroupMember).not.toHaveBeenCalled();
    expect(createWorkflowExecution).toHaveBeenCalledWith(
      expect.anything(),
      mockWorkflowId,
      mockUserId,
      expect.anything(),
      'pinned-group-1',
    );
    expect(mockAdd).toHaveBeenCalledWith('workflowExecution', expect.objectContaining({ userGroupId: 'pinned-group-1' }));
  });

  it('ignores a client-supplied userGroupId for a pinned workflow', async () => {
    const clientSuppliedGroupId = '550e8400-e29b-41d4-a716-446655440040';
    (getWorkflowForExecution as jest.Mock).mockResolvedValue({
      ...mockWorkflow,
      pinnedUserGroupId: 'pinned-group-1',
    });

    const caller = workflowsRouter.createCaller(ctx);
    await caller.executeWorkflow({ workflowId: mockWorkflowId, userGroupId: clientSuppliedGroupId });

    expect(isUserGroupMember).not.toHaveBeenCalled();
    expect(createWorkflowExecution).toHaveBeenCalledWith(
      expect.anything(),
      mockWorkflowId,
      mockUserId,
      expect.anything(),
      'pinned-group-1',
    );
  });

  it('should throw when the workflow queue is not initialized', async () => {
    const { getWorkflowQueue } = require('@/features/workflows/utils/worker/queue');
    getWorkflowQueue.mockReturnValueOnce(null);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.executeWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('Workflow system is not available at this time.');

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Error,
        event: AuditRecordEvent.WorkflowExecutionFormSubmission,
        metadata: expect.objectContaining({
          workflowId: mockWorkflowId,
          workflowExecutionId: mockExecutionId,
        }),
      }),
    );
  });
});
