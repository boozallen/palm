import { router } from '@/server/trpc';
import { copyWorkflowRoute } from '@/features/workflows/routes/copy-workflow';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import copyWorkflow from '@/features/workflows/dal/copyWorkflow';
import db from '@/server/db';

jest.mock('@/features/shared/dal/getUserWorkflowsAccess');
jest.mock('@/features/profile/dal/getUserGroups');
jest.mock('@/features/workflows/dal/copyWorkflow');
jest.mock('@/server/db', () => ({
  workflow: {
    findUnique: jest.fn(),
  },
}));

const workflowsRouter = router({ copyWorkflowRoute });

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockCopiedWorkflowId = '550e8400-e29b-41d4-a716-446655440099';

const mockWorkflow = {
  id: mockWorkflowId,
  name: 'Test Workflow',
  deletedAt: null,
};

const mockUserGroups = [
  { id: 'group-1' },
  { id: 'group-2' },
];

const mockCopyResult = {
  copiedWorkflowId: mockCopiedWorkflowId,
  workflowName: 'Test Workflow',
};

describe('copyWorkflowRoute', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;

    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(true);
    (db.workflow.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (copyWorkflow as jest.Mock).mockResolvedValue(mockCopyResult);
  });

  it('should copy a workflow successfully and return the result', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.copyWorkflowRoute({ workflowId: mockWorkflowId });

    expect(result).toEqual(mockCopyResult);
    expect(getUserWorkflowsAccess).toHaveBeenCalledWith(mockUserId);
    expect(copyWorkflow).toHaveBeenCalledWith({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      userGroupIds: ['group-1', 'group-2'],
    });
  });

  it('should throw Forbidden if user does not have workflows access', async () => {
    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(false);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.copyWorkflowRoute({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You do not have access to workflows');

    expect(copyWorkflow).not.toHaveBeenCalled();
  });

  it('should throw NotFound if workflow does not exist', async () => {
    (db.workflow.findUnique as jest.Mock).mockResolvedValue(null);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.copyWorkflowRoute({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('Workflow not found');

    expect(copyWorkflow).not.toHaveBeenCalled();
  });

  it('should reject invalid workflowId input', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.copyWorkflowRoute({ workflowId: 'not-a-uuid' }),
    ).rejects.toThrow();

    expect(copyWorkflow).not.toHaveBeenCalled();
  });

});
