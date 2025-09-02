import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupMembership, UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import createUserGroupMembership from '@/features/shared/dal/createUserGroupMembership';
import getUser from '@/features/settings/dal/shared/getUser';
import getUserGroup from '@/features/settings/dal/user-groups/getUserGroup';

jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');
jest.mock('@/features/shared/dal/createUserGroupMembership');
jest.mock('@/features/settings/dal/shared/getUser');
jest.mock('@/features/settings/dal/user-groups/getUserGroup');

describe('createUserGroupMembership route', () => {
  const mockCurrentUserId = '15b7ec31-a080-472c-aa88-b2daac066812';
  const mockUserGroupId = '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18';
  const mockInput = {
    userGroupId: mockUserGroupId,
    userId: 'b5df35d9-c8a9-4b8d-b904-87e197f4b1ef',
    role: UserGroupRole.User,
  };
  const mockMembership: UserGroupMembership = {
    name: 'Doe, John',
    userId: '15b7ec31-a080-472c-aa88-b2daac066812',
    userGroupId: mockUserGroupId,
    role: UserGroupRole.Lead,
    email: 'doe_john@domain.com',
    lastLoginAt: new Date(),
  };
  const mockUserGroupMembership: UserGroupMembership = {
    name: 'Smith, Jane',
    userId: 'b5df35d9-c8a9-4b8d-b904-87e197f4b1ef',
    userGroupId: mockUserGroupId,
    role: UserGroupRole.User,
    email: 'smith_jane@domain.com',
    lastLoginAt: new Date(),
  };

  const mockCurrentUser = {
    id: mockCurrentUserId,
    name: 'Doe, John',
    role: UserRole.Admin,
  };

  const mockTargetUser = {
    id: mockInput.userId,
    name: 'Smith, Jane',
    role: UserRole.User,
  };

  const mockUserGroup = {
    id: mockUserGroupId,
    label: 'Group 1',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 0,
  };
  const mockError = Forbidden('You do not have permission to access this resource');

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockCurrentUserId,
      userRole: UserRole.Admin,
      auditor: {
        createAuditRecord: jest.fn(),
      },
    } as unknown as ContextType;

    (getUserGroup as jest.Mock).mockResolvedValue(mockUserGroup);
  });

  (getUser as jest.Mock).mockImplementation((userId: string) => {
    if (userId === mockCurrentUserId) {
      return mockCurrentUser;
    }
    if (userId === mockInput.userId) {
      return mockTargetUser;
    }
    return null;
  });

  it('should return the created user group membership if user\'s Role is Admin', async () => {
    ctx.userRole = UserRole.Admin;
    (createUserGroupMembership as jest.Mock).mockResolvedValue(mockUserGroupMembership);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createUserGroupMembership(mockInput)).resolves.toEqual(mockUserGroupMembership);

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(createUserGroupMembership).toHaveBeenCalled();
  });

  it('should return the created user group membership if user\'s Role is NOT Admin but their membership Role is Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.Lead;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);
    (createUserGroupMembership as jest.Mock).mockResolvedValue(mockUserGroupMembership);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createUserGroupMembership(mockInput)).resolves.toEqual(mockUserGroupMembership);

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(createUserGroupMembership).toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'SUCCESS',
      description: `User ${mockCurrentUser.name} created a user group membership for user ${mockTargetUser.name} with a role of ${mockInput.role} in group ${mockUserGroup.label}`,
      event: 'CREATE_USER_GROUP_MEMBERSHIP',
    });
  });

  it('should throw an error if user\'s Role is NOT Admin && their membership Role is NOT Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createUserGroupMembership(mockInput)).rejects.toThrow(mockError);

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(createUserGroupMembership).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'WARN',
      description: `User ${mockCurrentUser.name} attempted to create a user group membership for user ${mockTargetUser.name} with a role of ${mockInput.role} in group ${mockUserGroup.label} but lacked permissions`,
      event: 'CREATE_USER_GROUP_MEMBERSHIP',
    });
  });

  it('should throw an error if user group membership creation fails due to Prisma P2002 error', async () => {
    ctx.userRole = UserRole.Admin;
    const mockPrismaError = new Error('Unique constraint violation');
    (createUserGroupMembership as jest.Mock).mockRejectedValue(mockPrismaError);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createUserGroupMembership(mockInput)).rejects.toThrow('Error creating user group membership');

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(createUserGroupMembership).toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'ERROR',
      description: `User ${mockCurrentUser.name} failed to create a user group membership for user ${mockTargetUser.name} with a role of ${mockInput.role} in group ${mockUserGroup.label}: ${mockPrismaError.message}`,
      event: 'CREATE_USER_GROUP_MEMBERSHIP',
    });
  }
  );

  it('rejects invalid userGroupId input', async () => {
    mockInput.userGroupId = 'invalid-UUID';

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createUserGroupMembership(mockInput)).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(createUserGroupMembership).not.toHaveBeenCalled();
  });

  it('rejects invalid userId input', async () => {
    mockInput.userId = 'invalid-UUID';

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createUserGroupMembership(mockInput)).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(createUserGroupMembership).not.toHaveBeenCalled();
  });
});
