import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import deleteUserGroup from '@/features/settings/dal/deleteUserGroup';
import getUser from '@/features/settings/dal/getUser';
import getUserGroup from '@/features/settings/dal/getUserGroup';

jest.mock('@/features/settings/dal/getUser');
jest.mock('@/features/settings/dal/getUserGroup');
jest.mock('@/features/settings/dal/deleteUserGroup', () => jest.fn());

describe('deleteUserGroup route', () => {
  const mockCurrentUser = {
    id: 'b5df35d9-c8a9-4b8d-b904-87e197f4b1ef',
    name: 'Doe, John',
    userRole: UserRole.Admin,
  };

  const mockUserGroupId = '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18';
  const mockUserGroup = {
    id: mockUserGroupId,
    label: 'User Group 1',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 5,
  };

  const mockResolve = { id: mockUserGroupId };
  const mockError = Forbidden('You do not have permission to access this resource');

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockCurrentUser.id,
      userRole: UserRole.Admin,
      auditor: {
        createAuditRecord: jest.fn(),
      },
    } as unknown as ContextType;

    (getUser as jest.Mock).mockResolvedValue(mockCurrentUser);
    (getUserGroup as jest.Mock).mockResolvedValue(mockUserGroup);
  });

  it('should delete and return the user group\'s Id successfully if user\'s Role is Admin', async () => {
    ctx.userRole = UserRole.Admin;
    (deleteUserGroup as jest.Mock).mockResolvedValue(mockResolve);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteUserGroup({ id: mockUserGroupId })).resolves.toEqual(mockResolve);

    expect(deleteUserGroup).toBeCalledWith(mockUserGroupId);
    expect(ctx.auditor.createAuditRecord).toBeCalledWith({
      outcome: 'SUCCESS',
      description: `User ${mockCurrentUser.name} deleted user group ${mockUserGroup.label}`,
      event: 'DELETE_USER_GROUP',
    });
  });

  it('should throw an error if user\'s Role is NOT Admin', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteUserGroup({ id: mockUserGroupId })).rejects.toThrow(mockError);

    expect(deleteUserGroup).not.toBeCalled();
    expect(ctx.auditor.createAuditRecord).toBeCalledWith({
      outcome: 'WARN',
      description: `User ${mockCurrentUser.name} attempted to delete user group ${mockUserGroup.label} but lacked permissions`,
      event: 'DELETE_USER_GROUP',
    });
  });

  it('rejects invalid userGroupId input', async () => {
    const mockInvalidUUID = 'invalid-UUID';

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteUserGroup({ id: mockInvalidUUID })).rejects.toThrow();

    expect(deleteUserGroup).not.toHaveBeenCalled();
  });

  it('should throw an error if deleting the user group fails due to Prisma code: 2015', async () => {
    ctx.userRole = UserRole.Admin;
    const mockPrismaError = new Error('Required record not found');
    (deleteUserGroup as jest.Mock).mockRejectedValue(mockPrismaError);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteUserGroup({ id: mockUserGroupId })).rejects.toThrow('Error deleting user group');

    expect(ctx.auditor.createAuditRecord).toBeCalledWith({
      outcome: 'ERROR',
      description: `User ${mockCurrentUser.name} failed to delete user group ${mockUserGroup.label}: ${mockPrismaError.message}`,
      event: 'DELETE_USER_GROUP',
    });
  });

});
