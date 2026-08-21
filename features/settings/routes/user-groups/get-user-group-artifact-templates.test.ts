import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import settingsRouter from '@/features/settings/routes';
import getUserGroupArtifactTemplates from '@/features/settings/dal/user-groups/getUserGroupArtifactTemplates';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';

jest.mock('@/features/settings/dal/user-groups/getUserGroupArtifactTemplates');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');

const mockGroupId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';
const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';

const mockTemplates = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    filename: 'sample-template.pptx',
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    updatedAt: new Date('2026-08-10T00:00:00.000Z'),
  },
];

const mockForbidden = Forbidden('You do not have permission to access this resource');

describe('getUserGroupArtifactTemplates route', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.Admin,
    } as unknown as ContextType;

    (getUserGroupArtifactTemplates as jest.Mock).mockResolvedValue(mockTemplates);
  });

  it('returns templates when user is Admin', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupArtifactTemplates({ id: mockGroupId }),
    ).resolves.toEqual({ userGroupTemplates: mockTemplates });

    expect(getUserGroupArtifactTemplates).toHaveBeenCalledWith(mockGroupId);
    expect(getUserGroupMembership).not.toHaveBeenCalled();
  });

  it('returns templates when user is a group Lead', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: mockGroupId,
      role: UserGroupRole.Lead,
    });

    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupArtifactTemplates({ id: mockGroupId }),
    ).resolves.toEqual({ userGroupTemplates: mockTemplates });

    expect(getUserGroupArtifactTemplates).toHaveBeenCalledWith(mockGroupId);
  });

  it('throws Forbidden when user is not Admin and not a Lead', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: mockGroupId,
      role: UserGroupRole.User,
    });

    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupArtifactTemplates({ id: mockGroupId }),
    ).rejects.toThrow(mockForbidden);

    expect(getUserGroupArtifactTemplates).not.toHaveBeenCalled();
  });

  it('throws Forbidden when user has no membership', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupArtifactTemplates({ id: mockGroupId }),
    ).rejects.toThrow(mockForbidden);

    expect(getUserGroupArtifactTemplates).not.toHaveBeenCalled();
  });

  it('rejects invalid UUID input', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupArtifactTemplates({ id: 'not-a-uuid' }),
    ).rejects.toThrow();

    expect(getUserGroupArtifactTemplates).not.toHaveBeenCalled();
  });
});
