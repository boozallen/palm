import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import getUsers from '@/features/settings/dal/shared/getUsers';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import settingsRouter from '@/features/settings/routes';

jest.mock('@/features/settings/dal/shared/getUsers');

describe('getUsersListWithRole', () => {
  let ctx: ContextType;

  const mockUserId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';

  const mockResults = [
    {
      id: mockUserId,
      name: 'Doe, John [USA]',
      email: 'doe_john@domain.com',
      role: UserRole.User,
    },
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc157',
      name: 'Doe, Alex [USA]',
      email: null,
      role: UserRole.User,
    },
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc158',
      name: 'Doe, Jane [USA]',
      email: 'doe_john@domain.com',
      role: UserRole.Admin,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getUsers as jest.Mock).mockResolvedValue(mockResults);

    ctx = {
      userId: mockUserId,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

  it('should get all users if user is an admin', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUsersListWithRole({ searchQuery: '' })
    ).resolves.toEqual({
      users: mockResults.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      })),
    });
    expect(getUsers).toHaveBeenCalled();
  });

  it('should throw an error if user is not an admin ', async () => {
    ctx.userRole = UserRole.User;
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUsersListWithRole({ searchQuery: '' })
    ).rejects.toThrow(mockError);

    expect(getUsers).not.toHaveBeenCalled();
  });
});
