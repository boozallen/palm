import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import getUserContextStudioAccess from '@/features/shared/dal/getUserContextStudioAccess';

jest.mock('@/features/shared/dal/getUserContextStudioAccess');

describe('getUserContextStudioAccess route', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: '15b7ec31-a080-472c-aa88-b2daac066812',
    } as unknown as ContextType;
  });

  it('should return hasAccess: true when user has Context Studio access', async () => {
    const mockData = true;
    (getUserContextStudioAccess as jest.Mock).mockResolvedValue(mockData);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getUserContextStudioAccess()).resolves.toEqual({
      hasAccess: mockData,
    });

    expect(getUserContextStudioAccess).toHaveBeenCalledWith(ctx.userId);
  });

  it('should return hasAccess: false when user does not have Context Studio access', async () => {
    const mockData = false;
    (getUserContextStudioAccess as jest.Mock).mockResolvedValue(mockData);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getUserContextStudioAccess()).resolves.toEqual({
      hasAccess: mockData,
    });

    expect(getUserContextStudioAccess).toHaveBeenCalledWith(ctx.userId);
  });
});
