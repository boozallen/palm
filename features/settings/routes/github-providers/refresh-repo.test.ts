import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import refreshSkillRepo from '@/features/settings/dal/github-providers/refreshSkillRepo';
import { TRPCError } from '@trpc/server';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/github-providers/refreshSkillRepo', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('refresh-repo', () => {
  const providerId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: 'f48c262b-435c-47db-97f2-5f7e4c3b34a6',
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('allows an Admin to refresh a skill repo', async () => {
    ctx.userRole = UserRole.Admin;

    (refreshSkillRepo as jest.Mock).mockResolvedValue({
      success: true,
      commit: 'abc123',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.refreshSkillRepo({ githubProviderId: providerId })).resolves.toEqual({
      success: true,
      commit: 'abc123',
    });
    expect(refreshSkillRepo).toHaveBeenCalledWith(providerId);
  });

  it('does not allow a non-Admin to refresh a skill repo', async () => {
    const error = new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You do not have permission to refresh skill repo',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.refreshSkillRepo({ githubProviderId: providerId })).rejects.toThrow(error);
    expect(refreshSkillRepo).not.toHaveBeenCalled();
  });

  it('returns error result when DAL reports failure', async () => {
    ctx.userRole = UserRole.Admin;

    (refreshSkillRepo as jest.Mock).mockResolvedValue({
      success: false,
      error: 'GitHub provider not found',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.refreshSkillRepo({ githubProviderId: providerId })).resolves.toEqual({
      success: false,
      error: 'GitHub provider not found',
    });
    expect(refreshSkillRepo).toHaveBeenCalledWith(providerId);
  });

  it('throws when DAL throws an error', async () => {
    ctx.userRole = UserRole.Admin;
    (refreshSkillRepo as jest.Mock).mockRejectedValue(new Error('Network error'));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.refreshSkillRepo({ githubProviderId: providerId })).rejects.toThrow('Network error');
    expect(refreshSkillRepo).toHaveBeenCalledWith(providerId);
  });

  it('validates githubProviderId is a UUID', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.refreshSkillRepo({ githubProviderId: 'not-a-uuid' })).rejects.toThrow();
    expect(refreshSkillRepo).not.toHaveBeenCalled();
  });
});
