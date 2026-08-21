import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import getSystemAdmins from '@/features/settings/dal/admins/getSystemAdmins';

jest.mock('@/features/settings/dal/admins/getSystemAdmins');

describe('getSystemAdmins route', () => {
  let ctx: ContextType;

  const mockAdmins = {
    admins: [
      {
        id: '75795c3e-ee76-4a2f-a485-7b0dd28c1f14',
        name: 'Doe, Alex [USA]',
        email: 'doe_alex@domain.com',
      },
      {
        id: '6da0b890-03cb-4f3e-859d-a092fa2a8b9e',
        name: 'Doe, Jane [USA]',
        email: null,
      },
      {
        id: '1f4b0b3c-5b7f-4f9b-8e7e-2c2b8f8f7b6b',
        name: 'Doe, John [USA]',
        email: 'doe_john@domain.com',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userRole: UserRole.Admin,
    } as unknown as ContextType;

    (getSystemAdmins as jest.Mock).mockResolvedValue(mockAdmins.admins);
  });

  it('should return a list of system admins for admin', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.getSystemAdmins()).resolves.toEqual(mockAdmins);

    expect(getSystemAdmins).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if user is not an admin', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.getSystemAdmins()).rejects.toThrow(
      'You do not have permission to access this resource'
    );

    expect(getSystemAdmins).not.toHaveBeenCalled();
  });
});
