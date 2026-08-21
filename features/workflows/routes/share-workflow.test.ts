import { router } from '@/server/trpc';
import { shareWorkflow } from '@/features/workflows/routes/share-workflow';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import createSharedWorkflow from '@/features/workflows/dal/createSharedWorkflow';
import db from '@/server/db';

jest.mock('@/features/shared/dal/getUserWorkflowsAccess');
jest.mock('@/features/profile/dal/getUserGroups');
jest.mock('@/features/workflows/dal/createSharedWorkflow');
jest.mock('@/server/db', () => ({
  workflow: {
    findUnique: jest.fn(),
  },
}));

const workflowsRouter = router({ shareWorkflow });

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

describe('shareWorkflow', () => {
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
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (createSharedWorkflow as jest.Mock).mockResolvedValue(mockSharedWorkflow);
  });

  it('should throw BadRequest when no user groups are provided', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.shareWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You must select at least one user group to share with');

    expect(createSharedWorkflow).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.ShareWorkflow,
      }),
    );
  });

  it('should throw BadRequest when empty user groups array is provided', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.shareWorkflow({ workflowId: mockWorkflowId, userGroupIds: [] }),
    ).rejects.toThrow('You must select at least one user group to share with');

    expect(createSharedWorkflow).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.ShareWorkflow,
      }),
    );
  });

  it('should share a workflow successfully when user groups are explicitly provided', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.shareWorkflow({
      workflowId: mockWorkflowId,
      userGroupIds: [mockGroupId1],
    });

    expect(result.sharedWorkflow).toEqual(mockSharedWorkflow);
    expect(getUserWorkflowsAccess).toHaveBeenCalledWith(mockUserId);
    expect(createSharedWorkflow).toHaveBeenCalledWith({
      sourceWorkflowId: mockWorkflowId,
      sourceUserId: mockUserId,
      sharedWithUserGroupIds: [mockGroupId1],
    });
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Success,
        event: AuditRecordEvent.ShareWorkflow,
      }),
    );
  });

  it('should throw Forbidden if user does not have workflows access', async () => {
    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(false);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.shareWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You do not have access to workflows');

    expect(createSharedWorkflow).not.toHaveBeenCalled();
  });

  it('should throw NotFound if workflow does not exist', async () => {
    (db.workflow.findUnique as jest.Mock).mockResolvedValue(null);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.shareWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('Workflow not found');

    expect(createSharedWorkflow).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.ShareWorkflow,
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
      caller.shareWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You do not have permission to share this workflow');

    expect(createSharedWorkflow).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.ShareWorkflow,
      }),
    );
  });

  it('should throw BadRequest if user is not a member of any user groups', async () => {
    (getUserGroups as jest.Mock).mockResolvedValue([]);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.shareWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You must be a member of at least one user group to share a workflow');

    expect(createSharedWorkflow).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.ShareWorkflow,
      }),
    );
  });

  it('should throw BadRequest if user tries to share with groups they are not a member of', async () => {
    const invalidGroupId = '550e8400-e29b-41d4-a716-446655440099';

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.shareWorkflow({
        workflowId: mockWorkflowId,
        userGroupIds: [mockGroupId1, invalidGroupId],
      }),
    ).rejects.toThrow('You can only share with user groups you are a member of');

    expect(createSharedWorkflow).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Warn,
        event: AuditRecordEvent.ShareWorkflow,
      }),
    );
  });

  it('should reject invalid workflowId input', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.shareWorkflow({ workflowId: 'not-a-uuid' }),
    ).rejects.toThrow();

    expect(createSharedWorkflow).not.toHaveBeenCalled();
  });

  it('should reject invalid userGroupIds input', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.shareWorkflow({
        workflowId: mockWorkflowId,
        userGroupIds: ['not-a-uuid'],
      }),
    ).rejects.toThrow();

    expect(createSharedWorkflow).not.toHaveBeenCalled();
  });

  it('should create audit record on error', async () => {
    const error = new Error('Database error');
    (createSharedWorkflow as jest.Mock).mockRejectedValue(error);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.shareWorkflow({
        workflowId: mockWorkflowId,
        userGroupIds: [mockGroupId1],
      }),
    ).rejects.toThrow('Database error');

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: AuditRecordOutcome.Error,
        event: AuditRecordEvent.ShareWorkflow,
      }),
    );
  });
});
