import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';
import getAgentProviders from '@/features/settings/dal/agent-providers/getAgentProviders';

jest.mock('@/features/settings/dal/agent-providers/getAgentProviders');

describe('getAgentProvidersRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';

  const mockProviders = [
    {
      id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
      name: 'Agent One',
      description: 'First agent',
      endpoint: 'https://agent-one.example.com',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
      name: 'Agent Two',
      description: 'Second agent',
      endpoint: 'https://agent-two.example.com',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('allows an Admin to get agent providers', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProviders as jest.Mock).mockResolvedValue(mockProviders);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getAgentProviders()).resolves.toEqual({
      agentProviders: mockProviders.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        endpoint: p.endpoint,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });

    expect(getAgentProviders).toHaveBeenCalled();
  });

  it('does not allow a non-Admin to get agent providers', async () => {
    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getAgentProviders()).rejects.toThrow(TRPCError);
    expect(getAgentProviders).not.toHaveBeenCalled();
  });

  it('propagates DAL errors', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProviders as jest.Mock).mockRejectedValue(new Error('Error fetching agent providers'));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getAgentProviders()).rejects.toThrow('Error fetching agent providers');
  });
});
