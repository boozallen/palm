import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';
import createAgentProvider from '@/features/settings/dal/agent-providers/createAgentProvider';

jest.mock('@/features/settings/dal/agent-providers/createAgentProvider');

describe('addAgentProviderRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockAgentProviderId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  const mockInput = {
    name: 'Test Agent',
    description: 'A test agent provider',
    endpoint: 'https://agent.example.com',
    apiKey: 'secret-key',
  };

  const mockCreatedProvider = {
    id: mockAgentProviderId,
    name: mockInput.name,
    description: mockInput.description,
    endpoint: mockInput.endpoint,
    apiKey: mockInput.apiKey,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      auditor: { createAuditRecord: jest.fn() },
    } as unknown as ContextType;
  });

  it('allows an Admin to add an agent provider', async () => {
    ctx.userRole = UserRole.Admin;
    (createAgentProvider as jest.Mock).mockResolvedValue(mockCreatedProvider);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addAgentProvider(mockInput)).resolves.toEqual({
      agentProvider: {
        id: mockAgentProviderId,
        name: mockInput.name,
        description: mockInput.description,
        endpoint: mockInput.endpoint,
        createdAt: mockCreatedProvider.createdAt,
        updatedAt: mockCreatedProvider.updatedAt,
      },
    });

    expect(createAgentProvider).toHaveBeenCalledWith({
      name: mockInput.name,
      description: mockInput.description,
      endpoint: mockInput.endpoint,
      apiKey: mockInput.apiKey,
    });
  });

  it('does not allow a non-Admin to add an agent provider', async () => {
    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addAgentProvider(mockInput)).rejects.toThrow(TRPCError);
    expect(createAgentProvider).not.toHaveBeenCalled();
  });

  it('rejects an invalid endpoint URL', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.addAgentProvider({ ...mockInput, endpoint: 'not-a-url' })
    ).rejects.toThrow();
    expect(createAgentProvider).not.toHaveBeenCalled();
  });

  it('propagates DAL errors', async () => {
    ctx.userRole = UserRole.Admin;
    (createAgentProvider as jest.Mock).mockRejectedValue(new Error('Error creating agent provider'));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addAgentProvider(mockInput)).rejects.toThrow('Error creating agent provider');
  });
});
