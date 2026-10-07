import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';
import { getConfig } from '@/server/config';
import logger from '@/server/logger';

jest.mock('@/server/logger');

global.fetch = jest.fn();

describe('testAgentServiceRoute', () => {
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

  it('allows an Admin to test LangGraph service successfully', async () => {
    ctx.userRole = UserRole.Admin;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
    });

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.agentServices.testAgentService({
      serviceId: 'langgraph',
    });

    expect(result).toEqual({
      isValid: true,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://langgraph.example.com/health',
      {
        method: 'GET',
        signal: expect.any(AbortSignal),
      }
    );
  });

  it('allows an Admin to test Claude service successfully', async () => {
    ctx.userRole = UserRole.Admin;
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
    });

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.agentServices.testAgentService({
      serviceId: 'claude',
    });

    expect(result).toEqual({
      isValid: true,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://claude.example.com/health',
      {
        method: 'GET',
        signal: expect.any(AbortSignal),
      }
    );
  });

  it('does not allow a non-Admin to test an agent service', async () => {
    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.agentServices.testAgentService({ serviceId: 'langgraph' })
    ).rejects.toThrow(TRPCError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('handles service returning non-200 status', async () => {
    ctx.userRole = UserRole.Admin;
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.agentServices.testAgentService({
      serviceId: 'langgraph',
    });

    expect(result).toEqual({
      isValid: false,
      errorMessage: 'Service returned status 500',
    });
    expect(logger.error).toHaveBeenCalledWith(
      '[AGENT-SERVICE/test] LangGraph health check failed',
      {
        serviceId: 'langgraph',
        status: 500,
        endpoint: 'https://langgraph.example.com',
      }
    );
  });

  it('handles fetch connection errors', async () => {
    ctx.userRole = UserRole.Admin;
    (fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.agentServices.testAgentService({
      serviceId: 'claude',
    });

    expect(result).toEqual({
      isValid: false,
      errorMessage: 'Connection refused',
    });
    expect(logger.error).toHaveBeenCalledWith(
      '[AGENT-SERVICE/test] Claude is unreachable',
      {
        serviceId: 'claude',
        error: expect.any(Error),
        endpoint: 'https://claude.example.com',
      }
    );
  });

  it('handles non-Error fetch failures', async () => {
    ctx.userRole = UserRole.Admin;
    (fetch as jest.Mock).mockRejectedValue('Network error');

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.agentServices.testAgentService({
      serviceId: 'langgraph',
    });

    expect(result).toEqual({
      isValid: false,
      errorMessage: 'Service is unreachable or timed out',
    });
  });

  it('rejects invalid service IDs', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.agentServices.testAgentService({ serviceId: 'invalid' as 'langgraph' })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
