import getUserAdvancedKbSettings from '@/features/shared/dal/getUserAdvancedKbSettings';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/shared/dal/getUserAdvancedKbSettings');

describe('get-user-advanced-kb-settings route', () => {
  const mockResolve = {
    knowledgeBasesMinScore: 0.5,
    knowledgeBasesMaxResults: 10,
  };

  const mockUserId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';

  const mockError = Unauthorized('You do not have permission to access this resource');
  
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('retrieves the user advanced knowledge base settings', async () => {
    (getUserAdvancedKbSettings as jest.Mock).mockResolvedValue(
      mockResolve
    );

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getUserAdvancedKbSettings()).resolves.toEqual(
      mockResolve
    );

    expect(getUserAdvancedKbSettings).toHaveBeenCalledTimes(1);
    expect(getUserAdvancedKbSettings).toHaveBeenCalledWith(mockUserId);
  });

  it('throws an error if there is no user', async () => {
    ctx = {
      userId: null,
    } as unknown as ContextType;

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getUserAdvancedKbSettings()).rejects.toThrow(
      mockError
    );

    expect(getUserAdvancedKbSettings).not.toHaveBeenCalled();
  });
});
