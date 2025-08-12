import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole, UserGroupMembership } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import deleteUserGroupMembership from '@/features/settings/dal/deleteUserGroupMembership';
import getUser from '@/features/settings/dal/getUser';
import getUserGroup from '@/features/settings/dal/getUserGroup';

jest.mock('@/features/settings/dal/getUser');
jest.mock('@/features/settings/dal/getUserGroup');
jest.mock('@/features/settings/dal/getUserGroupMembership', () => jest.fn());
jest.mock('@/features/settings/dal/deleteUserGroupMembership', () => jest.fn());

describe('deleteUserGroupMembership route', () => {
  const mockUserGroupId = '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18';
  const mockCurrentUserId = 'f4a7d7b4-f193-47ac-8ed2-35b27a1442ff';
  const mockTargetUserId = 'b5df35d9-c8a9-4b8d-b904-87e197f4b1ef';

  const mockCurrentUser = {
    id: mockCurrentUserId,
    name: 'Doe, John',
    userRole: UserRole.Admin,
  };

  const mockTargetUser = {
    id: mockTargetUserId,
    name: 'Doe, Jane',
    userRole: UserRole.User,
  };

  const mockUserGroup = {
    id: mockUserGroupId,
    label: 'User Group 1',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 5,
  };

  const mockDeletedMembership: UserGroupMembership = {
    userGroupId: mockUserGroupId,
    userId: mockTargetUserId,
    name: 'Doe, Jane',
    role: UserGroupRole.User,
    email: 'john.doe@example.com',
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set the default user role to Admin in the context
    ctx = {
      userId: mockCurrentUserId,
      userRole: UserRole.Admin,
      auditor: {
        createAuditRecord: jest.fn(),
      },
    } as unknown as ContextType;

    (deleteUserGroupMembership as jest.Mock).mockResolvedValue(mockDeletedMembership);

    (getUserGroup as jest.Mock).mockResolvedValue(mockUserGroup);
  });

  (getUser as jest.Mock).mockImplementation((userId: string) => {
    if (userId === mockCurrentUserId) {
      return mockCurrentUser;
    }
    if (userId === mockTargetUserId) {
      return mockTargetUser;
    }
    return null;
  });

  it('should delete and return the user group membership successfully if user\'s role is Admin', async () => {
    const membershipInput = {
      userGroupId: mockUserGroupId,
      userId: mockTargetUserId,
    };

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteUserGroupMembership(membershipInput)).resolves.toEqual(mockDeletedMembership);

    expect(deleteUserGroupMembership).toHaveBeenCalledWith(mockUserGroupId, mockTargetUserId);
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'SUCCESS',
      description: `User ${mockCurrentUser.name} deleted user group membership of user ${mockTargetUser.name} in user group ${mockUserGroup.label}`,
      event: 'DELETE_USER_GROUP_MEMBERSHIP',
    });
  });

  it('should allow a Lead to delete a user group membership of another user', async () => {
    const mockMembership = {
      userGroupId: mockUserGroupId,
      userId: ctx.userId,
      role: UserGroupRole.Lead,
      name: mockCurrentUser.name,
      email: 'lead@example.com',
    };

    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);
    ctx.userRole = UserRole.User; // Note: not Admin but user group Lead

    const caller = settingsRouter.createCaller(ctx);
    const input = { userGroupId: mockUserGroupId, userId: mockTargetUserId };

    await expect(caller.deleteUserGroupMembership(input)).resolves.toEqual(mockDeletedMembership);

    expect(deleteUserGroupMembership).toHaveBeenCalledWith(input.userGroupId, input.userId);
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'SUCCESS',
      description: `User ${mockCurrentUser.name} deleted user group membership of user ${mockTargetUser.name} in user group ${mockUserGroup.label}`,
      event: 'DELETE_USER_GROUP_MEMBERSHIP',
    });
  });

  it('should throw an error if user is a Lead attempting to delete themselves', async () => {
    const mockMembership = {
      userGroupId: mockUserGroupId,
      userId: ctx.userId,
      role: UserGroupRole.Lead,
      name: 'Lead User',
      email: 'lead@example.com',
    };

    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);
    ctx.userRole = UserRole.User; // Note: not Admin but user group Lead
    const input = { userGroupId: mockUserGroupId, userId: ctx.userId }; // Lead attempts to delete themselves

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteUserGroupMembership(input)).rejects.toThrow(
      BadRequest('Unable to process your request')
    );

    expect(deleteUserGroupMembership).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'WARN',
      description: `User ${mockCurrentUser.name} attempted to delete their own membership from user group ${mockUserGroup.label}`,
      event: 'DELETE_USER_GROUP_MEMBERSHIP',
    });
  });

  it('should throw an error if user does not have permission', async () => {
    (getUserGroupMembership as jest.Mock).mockResolvedValue(null);

    ctx.userRole = UserRole.User;
    const caller = settingsRouter.createCaller(ctx);
    const input = {
      userGroupId: mockUserGroupId,
      userId: mockTargetUserId,
    };

    await expect(caller.deleteUserGroupMembership(input)).rejects.toThrow(
      Forbidden('You do not have permission to access this resource')
    );

    expect(deleteUserGroupMembership).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'WARN',
      description: `User ${mockCurrentUser.name} attempted to delete user group membership of user ${mockTargetUser.name} in user group ${mockUserGroup.label} but lacked permissions`,
      event: 'DELETE_USER_GROUP_MEMBERSHIP',
    });
  });

  it('rejects invalid userGroupId input', async () => {
    const mockInvalidUserGroupId = 'invalid-UUID';
    const input = {
      userGroupId: mockInvalidUserGroupId,
      userId: mockTargetUserId,
    };

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteUserGroupMembership(input)).rejects.toThrow();

    expect(deleteUserGroupMembership).not.toHaveBeenCalled();
  });

  it('rejects invalid userId input', async () => {
    const mockInvalidUserId = 'invalid-UUID';
    const input = {
      userGroupId: mockUserGroupId,
      userId: mockInvalidUserId,
    };

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteUserGroupMembership(input)).rejects.toThrow();

    expect(deleteUserGroupMembership).not.toHaveBeenCalled();
  });

  it('should throw an error if deleting the user group membership fails', async () => {
    const mockPrismaError = new Error('Required record not found');
    const input = {
      userGroupId: mockUserGroupId,
      userId: mockTargetUserId,
    };
    (deleteUserGroupMembership as jest.Mock).mockRejectedValue(mockPrismaError);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteUserGroupMembership(input)).rejects.toThrow('Error deleting user group membership');

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'ERROR',
      description: `User ${mockCurrentUser.name} failed to delete user group membership of user ${mockTargetUser.name} in user group ${mockUserGroup.label}: ${mockPrismaError.message}`,
      event: 'DELETE_USER_GROUP_MEMBERSHIP',
    });
  });

});
