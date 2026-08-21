import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';
import getAgentProvider from '@/features/settings/dal/agent-providers/getAgentProvider';

jest.mock('@/features/settings/dal/agent-providers/getAgentProvider');

describe('getAgentProviderRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockAgentProviderId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  const mockProvider = {
    id: mockAgentProviderId,
    name: 'Test Agent',
    description: 'A test agent',
    endpoint: 'https://agent.example.com',
    apiKey: 'secret',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('allows an Admin to get a single agent provider', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(mockProvider);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getAgentProvider({ id: mockAgentProviderId })).resolves.toEqual({
      agentProvider: {
        id: mockProvider.id,
        name: mockProvider.name,
        description: mockProvider.description,
        endpoint: mockProvider.endpoint,
        createdAt: mockProvider.createdAt,
        updatedAt: mockProvider.updatedAt,
      },
    });

    expect(getAgentProvider).toHaveBeenCalledWith(mockAgentProviderId);
  });

  it('does not expose apiKey in the response', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(mockProvider);

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.getAgentProvider({ id: mockAgentProviderId });
    expect(result.agentProvider).not.toHaveProperty('apiKey');
  });

  it('does not allow a non-Admin to get an agent provider', async () => {
    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getAgentProvider({ id: mockAgentProviderId })).rejects.toThrow(TRPCError);
    expect(getAgentProvider).not.toHaveBeenCalled();
  });

  it('rejects an invalid id UUID', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getAgentProvider({ id: 'not-a-uuid' })
    ).rejects.toThrow();
    expect(getAgentProvider).not.toHaveBeenCalled();
  });

  it('propagates DAL errors', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockRejectedValue(new Error('Agent provider not found'));

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getAgentProvider({ id: mockAgentProviderId })
    ).rejects.toThrow('Agent provider not found');
  });
});
