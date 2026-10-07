import { UserRole } from '@/features/shared/types/user';
import getUserGraphDatabaseAccess from '@/features/shared/dal/getUserGraphDatabaseAccess';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/shared/dal/getUserGraphDatabaseAccess');

describe('getUserGraphDatabaseAccess route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should return hasAccess: true when user has graph database access', async () => {
    (getUserGraphDatabaseAccess as jest.Mock).mockResolvedValue(true);

    const caller = sharedRouter.createCaller(mockCtx);
    const result = await caller.getUserGraphDatabaseAccess();

    expect(result).toEqual({
      hasAccess: true,
    });

    expect(getUserGraphDatabaseAccess).toHaveBeenCalledWith('test-user-id');
  });

  it('should return hasAccess: false when user does not have graph database access', async () => {
    (getUserGraphDatabaseAccess as jest.Mock).mockResolvedValue(false);

    const caller = sharedRouter.createCaller(mockCtx);
    const result = await caller.getUserGraphDatabaseAccess();

    expect(result).toEqual({
      hasAccess: false,
    });

    expect(getUserGraphDatabaseAccess).toHaveBeenCalledWith('test-user-id');
  });

  it('should handle errors from getUserGraphDatabaseAccess', async () => {
    const mockError = new Error('Database error');
    (getUserGraphDatabaseAccess as jest.Mock).mockRejectedValue(mockError);

    const caller = sharedRouter.createCaller(mockCtx);

    await expect(caller.getUserGraphDatabaseAccess()).rejects.toThrow('Database error');

    expect(getUserGraphDatabaseAccess).toHaveBeenCalledWith('test-user-id');
  });
});