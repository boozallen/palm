import { router } from '@/server/trpc';
import { getWorkflow } from '@/features/workflows/routes/get-workflow';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import getWorkflowFromDb from '@/features/workflows/dal/getWorkflow';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';

jest.mock('@/features/workflows/dal/getWorkflow');
jest.mock('@/features/shared/dal/getUserWorkflowsAccess');

const workflowsRouter = router({ getWorkflow });

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';

const mockWorkflow = {
  id: mockWorkflowId,
  name: 'Test Workflow',
  description: 'A workflow',
  version: '1.0.0',
  definition: { primitives: [] },
  createdBy: mockUserId,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  creator: { id: mockUserId, name: 'Alice', email: 'alice@example.com' },
  userGroups: [],
  executions: [],
};

describe('getWorkflow route', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;

    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(true);
    (getWorkflowFromDb as jest.Mock).mockResolvedValue(mockWorkflow);
  });

  it('should return the workflow when the creator requests it', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.getWorkflow({ workflowId: mockWorkflowId });

    expect(getUserWorkflowsAccess).toHaveBeenCalledWith(mockUserId);
    expect(getWorkflowFromDb).toHaveBeenCalledWith(mockWorkflowId, mockUserId);
    expect(result).toMatchObject({ id: mockWorkflowId, name: 'Test Workflow' });
  });

  it('should return the workflow when a group member requests it', async () => {
    const groupMemberId = '550e8400-e29b-41d4-a716-446655440099';
    (getWorkflowFromDb as jest.Mock).mockResolvedValue({
      ...mockWorkflow,
      createdBy: 'another-user',
      userGroups: [{ id: 'g1', label: 'Team', userGroupMemberships: [{ userId: groupMemberId }] }],
    });

    const groupCtx = { ...ctx, userId: groupMemberId } as unknown as ContextType;
    const caller = workflowsRouter.createCaller(groupCtx);
    const result = await caller.getWorkflow({ workflowId: mockWorkflowId });

    expect(result).toMatchObject({ id: mockWorkflowId });
  });

  it('should throw if user does not have workflows access', async () => {
    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(false);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.getWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You do not have access to workflows');
  });

  it('should throw NotFound if the workflow is not in the DB', async () => {
    (getWorkflowFromDb as jest.Mock).mockResolvedValue(null);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.getWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('Workflow not found');
  });

  it('should throw Forbidden if a non-member non-creator requests the workflow', async () => {
    (getWorkflowFromDb as jest.Mock).mockResolvedValue({
      ...mockWorkflow,
      createdBy: 'another-user-id',
    });

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.getWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You do not have permission to view this workflow');
  });

  it('should return null pinnedUserGroup for a legacy, unpinned workflow', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.getWorkflow({ workflowId: mockWorkflowId });

    expect(result.pinnedUserGroupId).toBeUndefined();
    expect(result.pinnedUserGroup).toBeNull();
  });

  it('should return the pinned user group with its ai provider ids', async () => {
    (getWorkflowFromDb as jest.Mock).mockResolvedValue({
      ...mockWorkflow,
      pinnedUserGroupId: 'group-1',
      pinnedUserGroup: { id: 'group-1', label: 'Group One', aiProviders: [{ id: 'provider-1' }, { id: 'provider-2' }] },
    });

    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.getWorkflow({ workflowId: mockWorkflowId });

    expect(result.pinnedUserGroupId).toBe('group-1');
    expect(result.pinnedUserGroup).toEqual({
      id: 'group-1',
      label: 'Group One',
      aiProviderIds: ['provider-1', 'provider-2'],
    });
  });

  it('should reject a non-UUID workflowId', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.getWorkflow({ workflowId: 'not-a-uuid' }),
    ).rejects.toThrow();
  });
});
