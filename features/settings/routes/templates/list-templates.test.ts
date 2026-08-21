import { UserRole } from '@/features/shared/types/user';
import getTemplates from '@/features/settings/dal/templates/getTemplates';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/templates/getTemplates');
jest.mock('@/features/shared/dal/getIsUserGroupLead');

const mockTemplates = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    filename: 'sample-template.pptx',
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    updatedAt: new Date('2026-08-10T00:00:00.000Z'),
  },
];

describe('listTemplates route', () => {
  const ctx = {
    userRole: UserRole.Admin,
    userId: 'user-id',
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx.userRole = UserRole.Admin;
    (getTemplates as jest.Mock).mockResolvedValue(mockTemplates);
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(true);
  });

  it('returns templates when user is Admin', async () => {
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.listTemplates({});

    expect(getTemplates).toHaveBeenCalled();
    expect(result).toEqual({ templates: mockTemplates });
  });

  it('returns templates when user is a group lead', async () => {
    ctx.userRole = UserRole.User;
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(true);

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.listTemplates({});

    expect(result).toEqual({ templates: mockTemplates });
  });

  it('throws Forbidden when user is not Admin and not a group lead', async () => {
    ctx.userRole = UserRole.User;
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(false);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.listTemplates({})).rejects.toThrow(/do not have permission/i);
    expect(getTemplates).not.toHaveBeenCalled();
  });

  it('throws if DAL throws', async () => {
    (getTemplates as jest.Mock).mockRejectedValue(new Error('DAL error'));
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.listTemplates({})).rejects.toThrow('DAL error');
  });
});
