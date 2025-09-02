import { KbProviderType } from '@/features/shared/types';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import getUserGroupKbProviders from '@/features/settings/dal/user-groups/getUserGroupKbProviders';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';

jest.mock('@/features/settings/dal/user-groups/getUserGroupKbProviders');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');

describe('getUserGroupKbProviders route', () => {
  const ctx = {
    userRole: UserRole.Admin,
  } as unknown as ContextType;

  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  const mockResolvedValue = [
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
      kbProviderType: KbProviderType.KbProviderPalm,
      label: 'mockLabel',
      config: { apiKey: '123', apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17b',
      kbProviderType: KbProviderType.KbProviderPalm,
      label: 'mockLabel2',
      config: { apiKey: '123', model: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
  ];

  const mockReturnValue = [
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17b',
    },
  ];

  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

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
    (getUserGroupKbProviders as jest.Mock).mockResolvedValue(mockResolvedValue);
  });

  it('should return the KB provider if user\'s Role is Admin', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getUserGroupKbProviders({ userGroupId: mockUserGroupId })
    ).resolves.toEqual({ userGroupKbProviders: mockReturnValue });

    expect(getUserGroupKbProviders).toHaveBeenCalledWith(mockUserGroupId);
  });

  it('should fetch knowledge base providers if user is lead', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(
      mockUserGroupMembershipLead
    );

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getUserGroupKbProviders({ userGroupId: mockUserGroupId })
    ).resolves.toEqual({ userGroupKbProviders: mockReturnValue });

    expect(getUserGroupKbProviders).toHaveBeenCalledWith(mockUserGroupId);
  });

  it('should throw error if user is not an Admin and not a lead when fetching knowledge base providers', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(
      mockUserGroupMembershipUser
    );
    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getUserGroupKbProviders({ userGroupId: mockUserGroupId })
    ).rejects.toThrow(mockError);

    expect(getUserGroupKbProviders).not.toHaveBeenCalled();
  });
});
