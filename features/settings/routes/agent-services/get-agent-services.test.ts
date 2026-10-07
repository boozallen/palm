import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';
import { getConfig } from '@/server/config';

describe('getAgentServicesRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;

    (getConfig as jest.Mock).mockReturnValue({
      agentServices: {
        langgraphServiceUrl: 'https://langgraph.example.com',
        claudeServiceUrl: 'https://claude.example.com',
      },
      featureFlags: {
        prefix: 'Feature_',
        getValue: jest.fn().mockReturnValue(false),
      },
    });
  });

  it('allows an Admin to get agent services', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.agentServices.getAgentServices();

    expect(result).toEqual({
      services: [
        {
          id: 'langgraph',
          name: 'LangGraph',
          description: 'LangGraph agent service for graph-based workflows',
          endpoint: 'https://langgraph.example.com',
        },
        {
          id: 'claude',
          name: 'Claude',
          description: 'Claude agent service for AI-powered interactions',
          endpoint: 'https://claude.example.com',
        },
      ],
    });
  });

  it('does not allow a non-Admin to get agent services', async () => {
    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.agentServices.getAgentServices()).rejects.toThrow(TRPCError);
  });
});
