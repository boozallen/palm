import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import settingsRouter from '@/features/settings/routes';
import updateUserGroupArtifactTemplates from '@/features/settings/dal/user-groups/updateUserGroupArtifactTemplates';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';

jest.mock('@/features/settings/dal/user-groups/updateUserGroupArtifactTemplates');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');

const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
const mockTemplateId = '00000000-0000-0000-0000-000000000001';

const mockTemplates = [
  {
    id: mockTemplateId,
    filename: 'sample-template.pptx',
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    updatedAt: new Date('2026-08-10T00:00:00.000Z'),
  },
];

const mockForbidden = Forbidden('You do not have permission to access this resource');

describe('updateUserGroupArtifactTemplates route', () => {
  let ctx: ContextType;
  let mockInput: { userGroupId: string; templateId: string; enabled: boolean };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.Admin,
    } as unknown as ContextType;

    mockInput = {
      userGroupId: mockUserGroupId,
      templateId: mockTemplateId,
      enabled: true,
    };

    (updateUserGroupArtifactTemplates as jest.Mock).mockResolvedValue(mockTemplates);
  });

  it('updates templates when user is Admin', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupArtifactTemplates(mockInput)).resolves.toEqual({
      userGroupTemplates: mockTemplates,
    });

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupArtifactTemplates).toHaveBeenCalledWith(mockInput);
  });

  it('updates templates when user is a group Lead', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: mockUserGroupId,
      role: UserGroupRole.Lead,
    });

    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupArtifactTemplates(mockInput)).resolves.toEqual({
      userGroupTemplates: mockTemplates,
    });

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupArtifactTemplates).toHaveBeenCalledWith(mockInput);
  });

  it('throws Forbidden when user is not Admin and not a Lead', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: mockUserGroupId,
      role: UserGroupRole.User,
    });

    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupArtifactTemplates(mockInput)).rejects.toThrow(
      mockForbidden,
    );

    expect(updateUserGroupArtifactTemplates).not.toHaveBeenCalled();
  });

  it('rejects invalid templateId', async () => {
    mockInput.templateId = 'not-a-uuid';
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupArtifactTemplates(mockInput)).rejects.toThrow();

    expect(updateUserGroupArtifactTemplates).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId', async () => {
    mockInput.userGroupId = 'not-a-uuid';
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupArtifactTemplates(mockInput)).rejects.toThrow();

    expect(updateUserGroupArtifactTemplates).not.toHaveBeenCalled();
  });
});
