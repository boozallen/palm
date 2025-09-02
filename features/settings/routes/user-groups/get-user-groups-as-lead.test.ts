import settingsRouter from '@/features/settings/routes';
import getUserGroupsAsLead from '@/features/settings/dal/user-groups/getUserGroupsAsLead';
import { ContextType } from '@/server/trpc-context';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import { UserGroup } from '@/features/shared/types/user-group';

jest.mock('@/features/settings/dal/user-groups/getUserGroupsAsLead');

describe('getUserGroupsAsLead route', () => {
  const mockUserId = '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18';
  const mockUserGroups: UserGroup[] = [
    {
      id: 'd8283f19-fc06-40d2-ab82-52f7f02f2025',
      label: 'User Group 1',
      createdAt: new Date('2024-04-04T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
      memberCount: 5,
    },
    {
      id: 'd8283f19-fc06-40d2-ab82-52f7f02f2026',
      label: 'User Group 2',
      createdAt: new Date('2024-04-04T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
      memberCount: 10,
    },
  ];
  const mockError = Unauthorized(
    'You do not have permission to access this resource'
  );

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('returns user groups where the user is a Lead', async () => {
    (getUserGroupsAsLead as jest.Mock).mockResolvedValue(mockUserGroups);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getUserGroupsAsLead()).resolves.toEqual({
      userGroupsAsLead: mockUserGroups.map((userGroup) => ({
        id: userGroup.id,
        label: userGroup.label,
        createdAt: userGroup.createdAt,
        updatedAt: userGroup.updatedAt,
        memberCount: userGroup.memberCount,
      })),
    });

    expect(getUserGroupsAsLead).toHaveBeenCalled();
  });

  it('throws an error if the DAL fails', async () => {
    const rejectedError = new Error('getUserGroupsForLead DAL failed.');
    (getUserGroupsAsLead as jest.Mock).mockRejectedValue(rejectedError);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getUserGroupsAsLead()).rejects.toThrow(
      new Error(rejectedError.message, { cause: rejectedError })
    );

    expect(getUserGroupsAsLead).toHaveBeenCalled();
  });

  it('throws an error if the user is not authorized', async () => {
    ctx = {
      userId: null,
    } as unknown as ContextType;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getUserGroupsAsLead()).rejects.toThrow(mockError);

    expect(getUserGroupsAsLead).not.toHaveBeenCalled();
  });
});
