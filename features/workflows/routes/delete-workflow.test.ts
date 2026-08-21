import { router } from '@/server/trpc';
import { deleteWorkflow } from '@/features/workflows/routes/delete-workflow';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import deleteWorkflowRecord from '@/features/workflows/dal/deleteWorkflow';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';

jest.mock('@/features/workflows/dal/deleteWorkflow');
jest.mock('@/features/shared/dal/getUserWorkflowsAccess');

const workflowsRouter = router({ deleteWorkflow });

describe('deleteWorkflow route', () => {
  const mockUserId = 'b5df35d9-c8a9-4b8d-b904-87e197f4b1ef';
  const mockWorkflowId = '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18';
  
  const mockResolve = { id: mockWorkflowId };
  const mockError = Forbidden('You do not have access to workflows');

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
  });

  it('should delete and return the workflow id successfully when user has access', async () => {
    (deleteWorkflowRecord as jest.Mock).mockResolvedValue(mockResolve);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(caller.deleteWorkflow({ workflowId: mockWorkflowId })).resolves.toEqual(mockResolve);

    expect(deleteWorkflowRecord).toBeCalledWith(mockWorkflowId, mockUserId);
  });

  it('should throw an error if user does not have workflows access', async () => {
    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(false);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(caller.deleteWorkflow({ workflowId: mockWorkflowId })).rejects.toThrow(mockError);

    expect(deleteWorkflowRecord).not.toBeCalled();
  });

  it('rejects invalid workflowId input', async () => {
    const mockInvalidUUID = 'invalid-UUID';

    const caller = workflowsRouter.createCaller(ctx);
    await expect(caller.deleteWorkflow({ workflowId: mockInvalidUUID })).rejects.toThrow();

    expect(deleteWorkflowRecord).not.toHaveBeenCalled();
  });

  it('should throw an error if deleting the workflow fails', async () => {
    const mockError = new Error('Workflow not found');
    (deleteWorkflowRecord as jest.Mock).mockRejectedValue(mockError);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(caller.deleteWorkflow({ workflowId: mockWorkflowId })).rejects.toThrow('Error deleting workflow: Workflow not found');
  });

  it('should throw an error if user does not own the workflow', async () => {
    const mockError = new Error('You do not have permission to delete this workflow');
    (deleteWorkflowRecord as jest.Mock).mockRejectedValue(mockError);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(caller.deleteWorkflow({ workflowId: mockWorkflowId })).rejects.toThrow('Error deleting workflow: You do not have permission to delete this workflow');
  });
});