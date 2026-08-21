import getUserKnowledgeBases from '@/features/shared/dal/getUserKnowledgeBases';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import sharedRouter from '@/features/shared/routes';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/shared/dal/getUserKnowledgeBases');

describe('get-user-knowledge-bases procedure', () => {
  const mockKnowledgeBases = [
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
      label: 'Test KB 1',
      kbProviderId: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
      kbProviderLabel: 'PALM',
    },
    {
      id: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
      label: 'Test KB 2',
      kbProviderId: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
      kbProviderLabel: 'PALM',
    },
  ];
  const mockUserId = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

  const mockError = Unauthorized(
    'You do not have permission to access this resource'
  );
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;

    (getUserKnowledgeBases as jest.Mock).mockResolvedValue(mockKnowledgeBases);
  });

  it('should fail if there is no user session', async () => {
    ctx = {
      userId: null,
    } as unknown as ContextType;

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getUserKnowledgeBases()).rejects.toThrow(mockError);

    expect(getUserKnowledgeBases).not.toHaveBeenCalled();
  });

  it('should get all knowledge bases enabled by a user group', async () => {
    const caller = sharedRouter.createCaller(ctx);

    const result = await caller.getUserKnowledgeBases();

    expect(result).toEqual({
      userKnowledgeBases: mockKnowledgeBases,
    });

    expect(getUserKnowledgeBases).toHaveBeenCalledWith(mockUserId);
  });
});
