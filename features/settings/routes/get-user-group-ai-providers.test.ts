import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import settingsRouter from '@/features/settings/routes/index';
import { AiProviderType, Provider } from '@/features/shared/types';
import getUserGroupAiProviders from '@/features/settings/dal/getUserGroupAiProviders';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import { UserGroupRole } from '@/features/shared/types/user-group';

jest.mock('@/features/settings/dal/getUserGroupAiProviders');
jest.mock('@/features/settings/dal/getUserGroupMembership');

describe('getUserGroupAiProvidersRoute', () => {
  const ctx = {
    user: {
      role: UserRole.Admin,
    },
  } as unknown as ContextType;

  const mockResult: Provider[] = [
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
      label: 'Label 1',
      config: {
        id: '6b54ffcd-c884-45c9-aa6e-57347f4cc112',
        type: AiProviderType.OpenAi,
        apiKey: 'testKey',
        orgKey: 'testKey',
      },
      configTypeId: 1,
      typeId: 1,
      costPerInputToken: 500,
      costPerOutputToken: 100,
      createdAt: new Date('2021-09-01T00:00:00.000Z'),
      updatedAt: new Date('2021-09-01T00:00:00.000Z'),
    },
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
      label: 'Label 1',
      config: {
        id: '6b54ffcd-c884-45c9-aa6e-57347f4cc157',
        type: AiProviderType.AzureOpenAi,
        apiKey: 'testKey',
        apiEndpoint: 'testEndpoint',
        deploymentId: '6b54ffcd-c884-45c9-aa6e-57347f4cc159',
      },
      configTypeId: 1,
      typeId: 1,
      costPerInputToken: 500,
      costPerOutputToken: 100,
      createdAt: new Date('2021-09-01T00:00:00.000Z'),
      updatedAt: new Date('2021-09-01T00:00:00.000Z'),
    },
  ];

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
    (getUserGroupAiProviders as jest.Mock).mockResolvedValue(mockResult);
  });

  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );
  const mockGroupId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';

  it('should get user groups ai provider if user is Admin', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupAiProviders({ id: mockGroupId })
    ).resolves.toEqual({
      userGroupProviders: mockResult.map((provider) => ({
        id: provider.id,
        label: provider.label,
        typeId: 1,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      })),
    });
    expect(getUserGroupAiProviders).toHaveBeenCalled();
  });

  it('should throw error if user is not an Admin', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getUserGroupAiProviders({ id: mockGroupId })
    ).rejects.toThrow(mockError);
    expect(getUserGroupAiProviders).not.toHaveBeenCalled();
  });

  it('should get user group ai providers if user is lead', async () => {
    ctx.userRole = UserRole.User;
    const caller = settingsRouter.createCaller(ctx);
    (getUserGroupMembership as jest.Mock).mockResolvedValue(
      mockUserGroupMembershipLead
    );
    await expect(
      caller.getUserGroupAiProviders({ id: mockGroupId })
    ).resolves.toEqual({
      userGroupProviders: mockResult.map((provider) => ({
        id: provider.id,
        label: provider.label,
        typeId: 1,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      })),
    });
    expect(getUserGroupAiProviders).toHaveBeenCalled();
  });

  it('should throw error if user is not an Admin and not a lead when getting user group ai providers', async () => {
    ctx.userRole = UserRole.User;
    const caller = settingsRouter.createCaller(ctx);
    (getUserGroupMembership as jest.Mock).mockResolvedValue(
      mockUserGroupMembershipUser
    );
    await expect(
      caller.getUserGroupAiProviders({ id: mockGroupId })
    ).rejects.toThrow(mockError);
    expect(getUserGroupAiProviders).not.toHaveBeenCalled();
  });
});
