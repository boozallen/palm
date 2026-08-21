import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';

jest.mock('@/features/shared/dal/getUserWorkflowsAccess');

describe('getUserWorkflowsAccess route', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: '15b7ec31-a080-472c-aa88-b2daac066812',
    } as unknown as ContextType;
  });

  it('should return hasAccess: true when user has workflows access', async () => {
    const mockData = true;
    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(mockData);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getUserWorkflowsAccess()).resolves.toEqual({
      hasAccess: mockData,
    });

    expect(getUserWorkflowsAccess).toHaveBeenCalledWith(ctx.userId);
  });

  it('should return hasAccess: false when user does not have workflows access', async () => {
    const mockData = false;
    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(mockData);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getUserWorkflowsAccess()).resolves.toEqual({
      hasAccess: mockData,
    });

    expect(getUserWorkflowsAccess).toHaveBeenCalledWith(ctx.userId);
  });
});