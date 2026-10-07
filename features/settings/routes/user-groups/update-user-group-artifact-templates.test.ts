import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import settingsRouter from '@/features/settings/routes';
import updateUserGroupArtifactTemplates from '@/features/settings/dal/user-groups/updateUserGroupArtifactTemplates';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

jest.mock('@/features/settings/dal/user-groups/updateUserGroupArtifactTemplates');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');
jest.mock('@/features/settings/dal/shared/getUser');
jest.mock('@/server/db', () => ({
  userGroup: { findUnique: jest.fn() },
  artifactTemplate: { findUnique: jest.fn() },
}));

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
  const mockAuditor = { createAuditRecord: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.Admin,
      auditor: mockAuditor,
    } as unknown as ContextType;

    mockInput = {
      userGroupId: mockUserGroupId,
      templateId: mockTemplateId,
      enabled: true,
    };

    (updateUserGroupArtifactTemplates as jest.Mock).mockResolvedValue(mockTemplates);
    (getUser as jest.Mock).mockResolvedValue({ name: 'Alex Smith' });
    (db.userGroup.findUnique as jest.Mock).mockResolvedValue({ label: 'Test Group' });
    (db.artifactTemplate.findUnique as jest.Mock).mockResolvedValue({ filename: 'sample-template.pptx' });
  });

  it('updates templates when user is Admin', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupArtifactTemplates(mockInput)).resolves.toEqual({
      userGroupTemplates: mockTemplates,
    });

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupArtifactTemplates).toHaveBeenCalledWith(mockInput);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'Alex Smith enabled artifact template "sample-template.pptx" for user group "Test Group"',
      event: AuditRecordEvent.ModifyUserGroupArtifactTemplateAccess,
    });
  });

  it('audits a failure when the DAL call throws', async () => {
    const dalError = new Error('Database connection lost');
    (updateUserGroupArtifactTemplates as jest.Mock).mockRejectedValue(dalError);
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupArtifactTemplates(mockInput)).rejects.toThrow('Database connection lost');

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Error,
      description: 'Alex Smith failed to enable artifact template "sample-template.pptx" for user group "Test Group": Database connection lost',
      event: AuditRecordEvent.ModifyUserGroupArtifactTemplateAccess,
    });
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
