import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';
import deleteAgentProvider from '@/features/settings/dal/agent-providers/deleteAgentProvider';
import getAgentProvider from '@/features/settings/dal/agent-providers/getAgentProvider';

jest.mock('@/features/settings/dal/agent-providers/deleteAgentProvider');
jest.mock('@/features/settings/dal/agent-providers/getAgentProvider');

describe('deleteAgentProviderRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockAgentProviderId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockInput = { id: mockAgentProviderId };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      auditor: { createAuditRecord: jest.fn() },
    } as unknown as ContextType;
    (getAgentProvider as jest.Mock).mockResolvedValue({ id: mockAgentProviderId, name: 'Test Agent' });
  });

  it('allows an Admin to delete an agent provider', async () => {
    ctx.userRole = UserRole.Admin;
    (deleteAgentProvider as jest.Mock).mockResolvedValue(undefined);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteAgentProvider(mockInput)).resolves.toEqual({ success: true });
    expect(deleteAgentProvider).toHaveBeenCalledWith(mockAgentProviderId);
  });

  it('does not allow a non-Admin to delete an agent provider', async () => {
    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteAgentProvider(mockInput)).rejects.toThrow(TRPCError);
    expect(deleteAgentProvider).not.toHaveBeenCalled();
  });

  it('rejects an invalid id UUID', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.deleteAgentProvider({ id: 'not-a-uuid' })
    ).rejects.toThrow();
    expect(deleteAgentProvider).not.toHaveBeenCalled();
  });

  it('propagates DAL errors', async () => {
    ctx.userRole = UserRole.Admin;
    (deleteAgentProvider as jest.Mock).mockRejectedValue(new Error('Error deleting agent provider'));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteAgentProvider(mockInput)).rejects.toThrow('Error deleting agent provider');
  });
});
