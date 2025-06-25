import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import updateUserGroupMemberRole from '@/features/settings/dal/updateUserGroupMemberRole';
import getUser from '@/features/settings/dal/getUser';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { Auditor } from '@/server/auditor';
import { isFeatureOn } from '@/libs/featureFlags';

jest.mock('@/features/settings/dal/getUserGroupMembership');
jest.mock('@/features/settings/dal/updateUserGroupMemberRole');
jest.mock('@/features/settings/dal/getUser');
jest.mock('@/libs/featureFlags');

describe('updateUserGroupMemberRoleRoute', () => {
  const ctx = {
    userId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    auditor: {
      createAuditRecord: jest.fn(),
    } as unknown as Auditor,
  } as unknown as ContextType;

  const mockGroupId = 'a8cccffc-b523-4219-a242-71ecec71dcc6';
  const mockId = 'd7b0c4eb-d412-4e71-ae11-888ec1919572';
  const role = UserGroupRole.Lead;
  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

  const mockCurrentUser = {
    id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    name: 'Alex Smith',
    email: 'alex.smith@example.com',
    role: UserRole.Admin,
  };

  const mockTargetedUser = {
    id: 'd7b0c4eb-d412-4e71-ae11-888ec1919572',
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: UserRole.User,
  };

  const mockUserGroupMembershipLead = {
    userGroupId: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
    userId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    role: UserGroupRole.Lead,
  };

  const mockUserGroupMembershipUser = {
    userGroupId: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
    userId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    role: UserGroupRole.User,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (isFeatureOn as jest.Mock).mockReturnValue(true);
  });

  it('should update user group membership role if user is Admin', async () => {
    ctx.userRole = UserRole.Admin;
    (updateUserGroupMemberRole as jest.Mock).mockResolvedValue({
      role: role,
      userGroupId: mockGroupId,
      userId: mockId,
    });

    (getUser as jest.Mock).mockImplementation((userId: string) => {
      if (userId === ctx.userId) {
        return Promise.resolve(mockCurrentUser);
      } else if (userId === mockId) {
        return Promise.resolve(mockTargetedUser);
      }
      return Promise.resolve(null);
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.updateUserGroupMemberRole({
        userGroupId: mockGroupId,
        userId: mockId,
        role: role,
      })
    ).resolves.toEqual({
      role: role,
      userGroupId: mockGroupId,
      userId: mockId,
    });

    expect(updateUserGroupMemberRole).toHaveBeenCalledWith({
      userGroupId: mockGroupId,
      userId: mockId,
      role: role,
    });

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'SUCCESS',
      description: `${mockCurrentUser.name} updated user group membership role of ${mockTargetedUser.name} to ${role}`,
      event: 'MODIFY_USER_GROUP_MEMBERSHIP_ROLE',
    });
  });

  it('should update user group role if user is lead', async () => {
    (getUserGroupMembership as jest.Mock).mockResolvedValue(
      mockUserGroupMembershipLead
    );

    (updateUserGroupMemberRole as jest.Mock).mockResolvedValue({
      role: role,
      userGroupId: mockGroupId,
      userId: mockId,
    });

    (getUser as jest.Mock).mockImplementation((userId: string) => {
      if (userId === ctx.userId) {
        return Promise.resolve(mockCurrentUser);
      } else if (userId === mockId) {
        return Promise.resolve(mockTargetedUser);
      }
      return Promise.resolve(null);
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.updateUserGroupMemberRole({
        userGroupId: mockGroupId,
        userId: mockId,
        role: role,
      })
    ).resolves.toEqual({
      role: role,
      userGroupId: mockGroupId,
      userId: mockId,
    });

    expect(updateUserGroupMemberRole).toHaveBeenCalledWith({
      userGroupId: mockGroupId,
      userId: mockId,
      role: role,
    });

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'SUCCESS',
      description: `${mockCurrentUser.name} updated user group membership role of ${mockTargetedUser.name} to ${role}`,
      event: 'MODIFY_USER_GROUP_MEMBERSHIP_ROLE',
    });
  });

  it('should throw warning if user is not an Admin and not a lead when updating user group role', async () => {
    ctx.userRole = UserRole.User;
    const caller = settingsRouter.createCaller(ctx);

    (getUser as jest.Mock).mockImplementation((userId: string) => {
      if (userId === ctx.userId) {
        return Promise.resolve(mockCurrentUser);
      } else if (userId === mockId) {
        return Promise.resolve(mockTargetedUser);
      }
      return Promise.resolve(null);
    });

    (getUserGroupMembership as jest.Mock).mockResolvedValue(
      mockUserGroupMembershipUser
    );

    await expect(
      caller.updateUserGroupMemberRole({
        userGroupId: mockGroupId,
        userId: mockId,
        role: role,
      })
    ).rejects.toThrow(mockError);

    expect(updateUserGroupMemberRole).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'WARN',
      description: `${mockCurrentUser.name} attempted to update user group membership role of ${mockTargetedUser.name} from ${mockUserGroupMembershipUser.role} to ${role} but lacked permissions`,
      event: 'MODIFY_USER_GROUP_MEMBERSHIP_ROLE',
    });
  });

  it('should throw error if updating user group role fails due to Prisma P2002 error', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);

    (getUser as jest.Mock).mockImplementation((userId: string) => {
      if (userId === ctx.userId) {
        return Promise.resolve(mockCurrentUser);
      } else if (userId === mockId) {
        return Promise.resolve(mockTargetedUser);
      }
      return Promise.resolve(null);
    });

    (getUserGroupMembership as jest.Mock).mockResolvedValue(
      mockUserGroupMembershipLead
    );

    const mockPrismaError = new Error('Unique constraint violation');
    (updateUserGroupMemberRole as jest.Mock).mockRejectedValue(mockPrismaError);

    await expect(
      caller.updateUserGroupMemberRole({
        userGroupId: mockGroupId,
        userId: mockId,
        role: role,
      })
    ).rejects.toThrow('Error updating user group member role');

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'ERROR',
      description: `${mockCurrentUser.name} failed to update user group membership role of ${mockTargetedUser.name} to ${role}: ${mockPrismaError.message}`,
      event: 'MODIFY_USER_GROUP_MEMBERSHIP_ROLE',
    });
  });
});
