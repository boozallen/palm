import { UserRole } from '@/features/shared/types/user';
import deleteTemplate from '@/features/settings/dal/templates/deleteTemplate';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/templates/deleteTemplate');

const templateId = '00000000-0000-0000-0000-000000000001';

describe('deleteTemplate route', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userRole: UserRole.Admin,
      userId: 'user-id',
      auditor: {
        createAuditRecord: jest.fn(),
      },
    } as unknown as ContextType;

    (deleteTemplate as jest.Mock).mockResolvedValue({ id: templateId });
  });

  it('deletes a template when user is Admin', async () => {
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.deleteTemplate({ templateId });

    expect(deleteTemplate).toHaveBeenCalledWith(templateId);
    expect(result).toEqual({ id: templateId });
  });

  it('throws Forbidden when user is not Admin', async () => {
    ctx.userRole = UserRole.User;
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.deleteTemplate({ templateId })).rejects.toThrow(/do not have permission/i);
    expect(deleteTemplate).not.toHaveBeenCalled();
  });

  it('throws if DAL throws', async () => {
    (deleteTemplate as jest.Mock).mockRejectedValue(new Error('DAL error'));
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.deleteTemplate({ templateId })).rejects.toThrow('DAL error');
  });

  it('fails input validation for invalid UUID', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.deleteTemplate({ templateId: 'not-a-uuid' })).rejects.toThrow();
    expect(deleteTemplate).not.toHaveBeenCalled();
  });
});
