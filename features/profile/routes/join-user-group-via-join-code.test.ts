import profileRouter from '@/features/profile/routes';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUser from '@/features/settings/dal/getUser';
import { getUserGroupByJoinCode } from '@/features/profile/dal/getUserGroupByJoinCode';
import createUserGroupMembership from '@/features/shared/dal/createUserGroupMembership';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import getUserGroups from '@/features/profile/dal/getUserGroups';

jest.mock('@/features/settings/dal/getUser');
jest.mock('@/features/profile/dal/getUserGroupByJoinCode');
jest.mock('@/features/shared/dal/createUserGroupMembership');
jest.mock('@/features/profile/dal/getUserGroups');

describe('joinUserGroupByJoinCode procedure', () => {
  const mockCurrentUserId = '15b7ec31-a080-472c-aa88-b2daac066812';
  const mockJoinCode = 'AB8F4mLw';
  const mockInvalidJoinCode = 'invalid-join-code';
  const mockUserGroup = {
    id: '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18',
    label: 'Group 1',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 0,
  };
  const mockName = 'Doe, John';
  const mockUserGroupMembership = {
    userGroupId: mockUserGroup.id,
    userId: mockCurrentUserId,
    name: mockName,
    role: UserGroupRole.User,
    email: 'john@email.com',
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockCurrentUserId,
      userRole: UserRole.User,
      auditor: {
        createAuditRecord: jest.fn(),
      },
    } as unknown as ContextType;

    (getUser as jest.Mock).mockResolvedValue({ id: mockCurrentUserId, name: mockName });
    (getUserGroups as jest.Mock).mockResolvedValue([]);
  });

  it('should create a user group membership with a valid join code', async () => {
    (getUserGroupByJoinCode as jest.Mock).mockResolvedValue(mockUserGroup);
    (createUserGroupMembership as jest.Mock).mockResolvedValue(mockUserGroupMembership);

    const caller = profileRouter.createCaller(ctx);
    await expect(caller.joinUserGroupViaJoinCode({ joinCode: mockJoinCode }))
      .resolves.toEqual({ ...mockUserGroupMembership, label: mockUserGroup.label });

    expect(createUserGroupMembership).toHaveBeenCalledWith(
      mockUserGroup.id,
      mockCurrentUserId,
      UserGroupRole.User
    );
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'SUCCESS',
      description: `User ${mockName} joined user group ${mockUserGroup.label} via join code`,
      event: 'CREATE_USER_GROUP_MEMBERSHIP',
    });
  });

  it('should throw an error with an invalid join code', async () => {
    (getUserGroupByJoinCode as jest.Mock).mockResolvedValue(null);

    const caller = profileRouter.createCaller(ctx);
    await expect(caller.joinUserGroupViaJoinCode({
      joinCode: mockInvalidJoinCode,
    })).rejects.toThrow(/invalid or expired/);

    expect(createUserGroupMembership).not.toHaveBeenCalled();
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'ERROR',
      description: `User ${mockName} attempted invalid user group join code ${mockInvalidJoinCode}`,
      event: 'CREATE_USER_GROUP_MEMBERSHIP',
    });
  });

  it('throws an error if the user is already a member of the group', async () => {
    (getUserGroupByJoinCode as jest.Mock).mockResolvedValue(mockUserGroup);
    (getUserGroups as jest.Mock).mockResolvedValue([mockUserGroup]);
    const caller = profileRouter.createCaller(ctx);
    await expect(caller.joinUserGroupViaJoinCode({ joinCode: mockJoinCode }))
      .rejects.toThrow(/already a member/);
  });

  it('should handle errors during user group membership creation', async () => {
    (getUserGroupByJoinCode as jest.Mock).mockResolvedValue(mockUserGroup);
    const mockError = new Error('Creation failed');
    (createUserGroupMembership as jest.Mock).mockRejectedValue(mockError);

    const caller = profileRouter.createCaller(ctx);
    await expect(caller.joinUserGroupViaJoinCode({ joinCode: mockJoinCode }))
      .rejects.toThrow('Error creating user group membership');

    expect(createUserGroupMembership).toHaveBeenCalledWith(
      mockUserGroup.id,
      mockCurrentUserId,
      UserGroupRole.User
    );
    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'ERROR',
      description: `User ${mockName} failed to join user group ${mockUserGroup.label
        } despite valid join code: ${mockError.message}`,
      event: 'CREATE_USER_GROUP_MEMBERSHIP',
    });
  });
});
