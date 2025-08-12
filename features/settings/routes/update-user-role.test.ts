import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import updateUserRole from '@/features/settings/dal/updateUserRole';
import { Auditor } from '@/server/auditor';
import getUser from '../dal/getUser';

jest.mock('@/features/settings/dal/updateUserRole');
jest.mock('../dal/getUser');

describe('updateUserRole route', () => {
  let ctx: ContextType;

  const mockUserId = '54931f13-7db9-4a77-b9cd-785c2ab5c5d3';
  const mockUserRole = UserRole.Admin;

  const mockCurrentUser = {
    id: '54931f13-7db9-4a77-b9cd-785c2ab5c5d3',
    name: 'Alex Smith',
    email: 'alex_smith@domain.com',
    role: UserRole.Admin,
  };

  const mockTargetedUser = {
    id: '75795c3e-ee76-4a2f-a485-7b0dd28c1f14',
    name: 'Doe, Alex [USA]',
    email: 'doe_alex@domain.com',
    role: UserRole.Admin,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userRole: mockUserRole,
      userId: mockUserId,
      auditor: {
        createAuditRecord: jest.fn(),
      } as unknown as Auditor,
    } as ContextType;

    (updateUserRole as jest.Mock).mockResolvedValue(mockTargetedUser);
    (getUser as jest.Mock).mockImplementation((id: string) => {
      if (id === mockUserId) {
        return Promise.resolve(mockCurrentUser);
      } else if (id === mockTargetedUser.id) {
        return Promise.resolve(mockTargetedUser);
      }
      return Promise.resolve(null);
    });
  });

  it('should return updated user if user is an admin', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.updateUserRole({
        id: mockTargetedUser.id,
        role: UserRole.Admin,
      })
    ).resolves.toEqual(mockTargetedUser);

    expect(updateUserRole).toHaveBeenCalledTimes(1);
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'SUCCESS',
      description: `${mockCurrentUser.name} updated user role of ${mockTargetedUser.name} from ${mockTargetedUser.role} to ${UserRole.Admin}`,
      event: 'MODIFY_USER_ROLE',
    });
  });

  it('should throw an error if user is not an admin', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.updateUserRole({
        id: mockTargetedUser.id,
        role: UserRole.Admin,
      })
    ).rejects.toThrow('You do not have permission to access this resource');

    expect(updateUserRole).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'WARN',
      description: `${mockCurrentUser.name} attempted to update user role of ${mockTargetedUser.name} from ${mockTargetedUser.role} to ${UserRole.Admin} but lacked permissions`,
      event: 'MODIFY_USER_ROLE',
    });
  });

  it('should throw error if user tries to update their own role', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.updateUserRole({
        id: mockUserId,
        role: UserRole.Admin,
      })
    ).rejects.toThrow('You cannot change your own role');

    expect(updateUserRole).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'WARN',
      description: `${mockCurrentUser.name} attempted to update their user role from ${mockCurrentUser.role} to ${UserRole.Admin}`,
      event: 'MODIFY_USER_ROLE',
    });
  });

  it('should throw an error if updating the user role fails due to Prisma code: 2015', async () => {
    ctx.userRole = UserRole.Admin;
    const mockPrismaError = new Error('Required record not found');
    (updateUserRole as jest.Mock).mockRejectedValue(mockPrismaError);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserRole({ id: mockTargetedUser.id, role: UserRole.Admin })).rejects.toThrow('Error updating user role');

    expect(ctx.auditor.createAuditRecord).toBeCalledWith({
      outcome: 'ERROR',
      description: `${mockCurrentUser.name} failed to update user role of ${mockTargetedUser.name} from ${mockTargetedUser.role} to ${UserRole.Admin}: ${mockPrismaError.message}`,
      event: 'MODIFY_USER_ROLE',
    });
  });

});
