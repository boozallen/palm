import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroup, UserGroupMembership, UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import getUserGroup from '@/features/settings/dal/getUserGroup';

jest.mock('@/features/settings/dal/getUserGroupMembership');
jest.mock('@/features/settings/dal/getUserGroup');

describe('getUserGroup route', () => {

  let ctx: ContextType;
  const mockMembership: UserGroupMembership = {
    name: 'Doe, John',
    userId: '15b7ec31-a080-472c-aa88-b2daac066812',
    userGroupId: '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18',
    role: UserGroupRole.Lead,
    email: 'doe_john@domain.com',
  };
  const mockUserGroup: UserGroup = {
    id: '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18',
    label: 'mockUserGroup',
    joinCode: 'ABC12345',
    createdAt: new Date('2024-02-02T00:00:00.000Z'),
    updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    memberCount: 1,
  };
  const mockError = Forbidden('You do not have permission to access this resource');

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: '15b7ec31-a080-472c-aa88-b2daac066812',
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return the user group if user\'s Role is Admin', async () => {
    ctx.userRole = UserRole.Admin;
    (getUserGroup as jest.Mock).mockResolvedValue(mockUserGroup);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getUserGroup({ id: mockUserGroup.id })).resolves.toEqual(mockUserGroup);

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(getUserGroup).toHaveBeenCalled();
  });

  it('should return the user group if user\'s Role is NOT Admin but their membership Role is Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.Lead;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);
    (getUserGroup as jest.Mock).mockResolvedValue(mockUserGroup);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getUserGroup({ id: mockUserGroup.id })).resolves.toEqual(mockUserGroup);

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(getUserGroup).toHaveBeenCalled();
  });

  it('should throw an error if user\'s Role is NOT Admin && their membership Role is NOT Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getUserGroup({ id: mockUserGroup.id })).rejects.toThrow(mockError);

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(getUserGroup).not.toHaveBeenCalled();
  });

});
