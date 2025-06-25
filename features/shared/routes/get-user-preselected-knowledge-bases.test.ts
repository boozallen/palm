import getUserPreselectedKnowledgeBases from '@/features/shared/dal/getUserPreselectedKnowledgeBases';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/shared/dal/getUserPreselectedKnowledgeBases');

describe('get-user-preselected-knowledge-bases route', () => {
  const mockResolve = {
    userPreselectedKnowledgeBases: [
      { id: '230a46ee-ab0a-4267-8a39-acd7625a4864' },
      { id: '24b9af27-87fb-4093-b35b-105c42956bc2' },
      { id: 'a5256f22-4438-42d4-b395-3295d1707e9d' },
    ],
  };
  const mockUserId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';
  const mockError = Unauthorized(
    'You do not have permission to access this resource'
  );
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('retrieves the user\'s preselected KnowledgeBases', async () => {
    (getUserPreselectedKnowledgeBases as jest.Mock).mockResolvedValue(
      mockResolve
    );

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getUserPreselectedKnowledgeBases()).resolves.toEqual(
      mockResolve
    );

    expect(getUserPreselectedKnowledgeBases).toHaveBeenCalledTimes(1);
    expect(getUserPreselectedKnowledgeBases).toHaveBeenCalledWith(mockUserId);
  });

  it('throws an error if there is no user', async () => {
    ctx = {
      userId: null,
    } as unknown as ContextType;

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getUserPreselectedKnowledgeBases()).rejects.toThrow(
      mockError
    );

    expect(getUserPreselectedKnowledgeBases).not.toHaveBeenCalled();
  });
});
