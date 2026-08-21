import { router } from '@/server/trpc';
import { updateWorkflowShares } from '@/features/workflows/routes/update-workflow-shares';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import createSharedWorkflow from '@/features/workflows/dal/createSharedWorkflow';
import softDeleteSharedWorkflow from '@/features/workflows/dal/softDeleteSharedWorkflow';
import db from '@/server/db';

jest.mock('@/features/shared/dal/getUserWorkflowsAccess');
jest.mock('@/features/profile/dal/getUserGroups');
jest.mock('@/features/workflows/dal/createSharedWorkflow');
jest.mock('@/features/workflows/dal/softDeleteSharedWorkflow');
jest.mock('@/server/db', () => ({
  workflow: {
    findUnique: jest.fn(),
  },
  sharedWorkflow: {
    findFirst: jest.fn(),
  },
  sharedWorkflowAction: {
    createMany: jest.fn(),
  },
}));

const workflowsRouter = router({ updateWorkflowShares });

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockGroupId1 = '550e8400-e29b-41d4-a716-446655440010';
const mockGroupId2 = '550e8400-e29b-41d4-a716-446655440011';

const mockWorkflow = {
  id: mockWorkflowId,
  name: 'Test Workflow',
  createdBy: mockUserId,
  deletedAt: null,
};

const mockUserGroups = [
  { id: mockGroupId1, label: 'Group 1' },
  { id: mockGroupId2, label: 'Group 2' },
];

const mockSharedWorkflow = {
  id: '550e8400-e29b-41d4-a716-446655440099',
  sourceWorkflowId: mockWorkflowId,
  sourceUserId: mockUserId,
  sharedWithUserGroupIds: [mockGroupId1, mockGroupId2],
  createdAt: new Date(),
};

describe('updateWorkflowShares', () => {
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
    (db.workflow.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
    (db.sharedWorkflow.findFirst as jest.Mock).mockResolvedValue(null);
    (db.sharedWorkflowAction.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (softDeleteSharedWorkflow as jest.Mock).mockResolvedValue(undefined);
    (createSharedWorkflow as jest.Mock).mockResolvedValue(mockSharedWorkflow);
  });

  it('should throw BadRequest when no user groups parameter is provided', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.updateWorkflowShares({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You must explicitly specify which user groups to share with (or provide an empty array to unshare)');

    expect(softDeleteSharedWorkflow).not.toHaveBeenCalled();
    expect(createSharedWorkflow).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.UpdateWorkflowShares,
      }),
    );
  });

  it('should allow unsharing by providing an empty user groups array', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.updateWorkflowShares({
      workflowId: mockWorkflowId,
      userGroupIds: [],
    });

    expect(result.sharedWorkflow).toEqual(mockSharedWorkflow);
    expect(getUserWorkflowsAccess).toHaveBeenCalledWith(mockUserId);
    expect(softDeleteSharedWorkflow).toHaveBeenCalledWith({
      sourceWorkflowId: mockWorkflowId,
      sourceUserId: mockUserId,
    });
    expect(createSharedWorkflow).toHaveBeenCalledWith({
      sourceWorkflowId: mockWorkflowId,
      sourceUserId: mockUserId,
      sharedWithUserGroupIds: [],
    });
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Success,
        event: AuditRecordEvent.UpdateWorkflowShares,
      }),
    );
  });

  it('should update workflow shares successfully when user groups are explicitly provided', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.updateWorkflowShares({
      workflowId: mockWorkflowId,
      userGroupIds: [mockGroupId1],
    });

    expect(result.sharedWorkflow).toEqual(mockSharedWorkflow);
    expect(getUserWorkflowsAccess).toHaveBeenCalledWith(mockUserId);
    expect(softDeleteSharedWorkflow).toHaveBeenCalledWith({
      sourceWorkflowId: mockWorkflowId,
      sourceUserId: mockUserId,
    });
    expect(createSharedWorkflow).toHaveBeenCalledWith({
      sourceWorkflowId: mockWorkflowId,
      sourceUserId: mockUserId,
      sharedWithUserGroupIds: [mockGroupId1],
    });
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Success,
        event: AuditRecordEvent.UpdateWorkflowShares,
      }),
    );
  });

  it('should throw Forbidden if user does not have workflows access', async () => {
    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(false);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.updateWorkflowShares({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You do not have access to workflows');

    expect(softDeleteSharedWorkflow).not.toHaveBeenCalled();
    expect(createSharedWorkflow).not.toHaveBeenCalled();
  });

  it('should throw NotFound if workflow does not exist', async () => {
    (db.workflow.findUnique as jest.Mock).mockResolvedValue(null);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.updateWorkflowShares({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('Workflow not found');

    expect(softDeleteSharedWorkflow).not.toHaveBeenCalled();
    expect(createSharedWorkflow).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.UpdateWorkflowShares,
      }),
    );
  });

  it('should throw Forbidden if user is not the workflow owner', async () => {
    (db.workflow.findUnique as jest.Mock).mockResolvedValue({
      ...mockWorkflow,
      createdBy: 'different-user-id',
    });

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.updateWorkflowShares({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You do not have permission to update shares for this workflow');

    expect(softDeleteSharedWorkflow).not.toHaveBeenCalled();
    expect(createSharedWorkflow).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.UpdateWorkflowShares,
      }),
    );
  });

  it('should throw BadRequest if user is not a member of any user groups', async () => {
    (getUserGroups as jest.Mock).mockResolvedValue([]);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.updateWorkflowShares({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You must be a member of at least one user group to update workflow shares');

    expect(softDeleteSharedWorkflow).not.toHaveBeenCalled();
    expect(createSharedWorkflow).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.UpdateWorkflowShares,
      }),
    );
  });

  it('should throw BadRequest if user tries to share with groups they are not a member of', async () => {
    const invalidGroupId = '550e8400-e29b-41d4-a716-446655440099';

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.updateWorkflowShares({
        workflowId: mockWorkflowId,
        userGroupIds: [mockGroupId1, invalidGroupId],
      }),
    ).rejects.toThrow('You can only share with user groups you are a member of');

    expect(softDeleteSharedWorkflow).not.toHaveBeenCalled();
    expect(createSharedWorkflow).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.UpdateWorkflowShares,
      }),
    );
  });

  it('should reject invalid workflowId input', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.updateWorkflowShares({ workflowId: 'not-a-uuid' }),
    ).rejects.toThrow();

    expect(softDeleteSharedWorkflow).not.toHaveBeenCalled();
    expect(createSharedWorkflow).not.toHaveBeenCalled();
  });

  it('should reject invalid userGroupIds input', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.updateWorkflowShares({
        workflowId: mockWorkflowId,
        userGroupIds: ['not-a-uuid'],
      }),
    ).rejects.toThrow();

    expect(softDeleteSharedWorkflow).not.toHaveBeenCalled();
    expect(createSharedWorkflow).not.toHaveBeenCalled();
  });

  it('should create audit record on error', async () => {
    const error = new Error('Database error');
    (createSharedWorkflow as jest.Mock).mockRejectedValue(error);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.updateWorkflowShares({
        workflowId: mockWorkflowId,
        userGroupIds: [mockGroupId1],
      }),
    ).rejects.toThrow('Database error');

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Error,
        event: AuditRecordEvent.UpdateWorkflowShares,
      }),
    );
  });

  it('should preserve accepted actions when refreshing shares', async () => {
    const mockAcceptedUserId = '550e8400-e29b-41d4-a716-446655440050';
    const mockCopiedWorkflowId = '550e8400-e29b-41d4-a716-446655440051';
    const existingSharedWorkflowWithActions = {
      id: '550e8400-e29b-41d4-a716-446655440098',
      sourceWorkflowId: mockWorkflowId,
      sourceUserId: mockUserId,
      sharedWithUserGroupIds: [mockGroupId1],
      actions: [
        {
          id: '550e8400-e29b-41d4-a716-446655440060',
          sharedWorkflowId: '550e8400-e29b-41d4-a716-446655440098',
          userId: mockAcceptedUserId,
          status: 'accepted',
          copiedWorkflowId: mockCopiedWorkflowId,
        },
      ],
    };

    (db.sharedWorkflow.findFirst as jest.Mock).mockResolvedValue(existingSharedWorkflowWithActions);

    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.updateWorkflowShares({
      workflowId: mockWorkflowId,
      userGroupIds: [mockGroupId1],
    });

    expect(result.sharedWorkflow).toEqual(mockSharedWorkflow);
    expect(db.sharedWorkflow.findFirst).toHaveBeenCalledWith({
      where: {
        sourceWorkflowId: mockWorkflowId,
        sourceUserId: mockUserId,
        deletedAt: null,
      },
      include: {
        actions: {
          where: {
            status: 'accepted',
          },
        },
      },
    });
    expect(db.sharedWorkflowAction.createMany).toHaveBeenCalledWith({
      data: [
        {
          sharedWorkflowId: mockSharedWorkflow.id,
          userId: mockAcceptedUserId,
          status: 'accepted',
          copiedWorkflowId: mockCopiedWorkflowId,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('should not preserve accepted actions when there are none', async () => {
    const existingSharedWorkflowWithoutActions = {
      id: '550e8400-e29b-41d4-a716-446655440098',
      sourceWorkflowId: mockWorkflowId,
      sourceUserId: mockUserId,
      sharedWithUserGroupIds: [mockGroupId1],
      actions: [],
    };

    (db.sharedWorkflow.findFirst as jest.Mock).mockResolvedValue(existingSharedWorkflowWithoutActions);

    const caller = workflowsRouter.createCaller(ctx);
    await caller.updateWorkflowShares({
      workflowId: mockWorkflowId,
      userGroupIds: [mockGroupId1],
    });

    expect(db.sharedWorkflowAction.createMany).not.toHaveBeenCalled();
  });
});
