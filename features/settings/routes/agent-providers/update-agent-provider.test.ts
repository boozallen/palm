import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';
import updateAgentProvider from '@/features/settings/dal/agent-providers/updateAgentProvider';

jest.mock('@/features/settings/dal/agent-providers/updateAgentProvider');

describe('updateAgentProviderRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockAgentProviderId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  const mockInput = {
    id: mockAgentProviderId,
    name: 'Updated Agent',
    description: 'Updated description',
    endpoint: 'https://agent.example.com',
    apiKey: 'new-secret-key',
  };

  const mockUpdatedProvider = {
    id: mockAgentProviderId,
    name: mockInput.name,
    description: mockInput.description,
    endpoint: mockInput.endpoint,
    apiKey: mockInput.apiKey,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('allows an Admin to update an agent provider', async () => {
    ctx.userRole = UserRole.Admin;
    (updateAgentProvider as jest.Mock).mockResolvedValue(mockUpdatedProvider);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateAgentProvider(mockInput)).resolves.toEqual({
      agentProvider: {
        id: mockAgentProviderId,
        name: mockInput.name,
        description: mockInput.description,
        endpoint: mockInput.endpoint,
        createdAt: mockUpdatedProvider.createdAt,
        updatedAt: mockUpdatedProvider.updatedAt,
      },
    });

    expect(updateAgentProvider).toHaveBeenCalledWith({
      id: mockInput.id,
      name: mockInput.name,
      description: mockInput.description,
      endpoint: mockInput.endpoint,
      apiKey: mockInput.apiKey,
    });
  });

  it('does not allow a non-Admin to update an agent provider', async () => {
    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateAgentProvider(mockInput)).rejects.toThrow(TRPCError);
    expect(updateAgentProvider).not.toHaveBeenCalled();
  });

  it('rejects an invalid id UUID', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.updateAgentProvider({ ...mockInput, id: 'not-a-uuid' })
    ).rejects.toThrow();
    expect(updateAgentProvider).not.toHaveBeenCalled();
  });

  it('rejects an invalid endpoint URL', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.updateAgentProvider({ ...mockInput, endpoint: 'not-a-url' })
    ).rejects.toThrow();
    expect(updateAgentProvider).not.toHaveBeenCalled();
  });

  it('propagates DAL errors', async () => {
    ctx.userRole = UserRole.Admin;
    (updateAgentProvider as jest.Mock).mockRejectedValue(new Error('Error updating agent provider'));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateAgentProvider(mockInput)).rejects.toThrow('Error updating agent provider');
  });
});
