import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';
import getAgentProvider from '@/features/settings/dal/agent-providers/getAgentProvider';
import logger from '@/server/logger';

jest.mock('@/features/settings/dal/agent-providers/getAgentProvider');
jest.mock('@/server/logger');

global.fetch = jest.fn();

describe('testAgentProviderRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockAgentProviderId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  const mockAgentProvider = {
    id: mockAgentProviderId,
    name: 'Test Agent',
    description: 'A test agent provider',
    endpoint: 'https://agent.example.com',
    apiKey: 'secret-key',
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

  it('allows an Admin to test an agent provider successfully', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(mockAgentProvider);
    const mockSessionId = 'test-session-123';
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: mockSessionId }),
    });

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.testAgentProvider({
      agentProviderId: mockAgentProviderId,
    });

    expect(result).toEqual({
      text: `Session created successfully: ${mockSessionId}`,
      isValid: true,
    });

    expect(getAgentProvider).toHaveBeenCalledWith(mockAgentProviderId);
    expect(fetch).toHaveBeenCalledWith(
      'https://agent.example.com/sessions/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer secret-key',
        },
        body: JSON.stringify({
          idea: 'Test connection',
          prd_path: '',
        }),
      }
    );
  });

  it('allows an Admin to test an agent provider without API key', async () => {
    ctx.userRole = UserRole.Admin;
    const providerWithoutKey = { ...mockAgentProvider, apiKey: null };
    (getAgentProvider as jest.Mock).mockResolvedValue(providerWithoutKey);
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: 'test-session-456' }),
    });

    const caller = settingsRouter.createCaller(ctx);
    await caller.testAgentProvider({ agentProviderId: mockAgentProviderId });

    expect(fetch).toHaveBeenCalledWith(
      'https://agent.example.com/sessions/create',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
  });

  it('handles response without session_id field', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(mockAgentProvider);
    const responseData = { message: 'Hello', status: 'ok' };
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => responseData,
    });

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.testAgentProvider({
      agentProviderId: mockAgentProviderId,
    });

    expect(result).toEqual({
      text: '',
      isValid: false,
      errorMessage: 'Invalid response: missing session_id',
    });
    expect(logger.error).toHaveBeenCalledWith(
      '[AGENT-PROVIDER/test] No session_id in response',
      { responseData }
    );
  });

  it('does not allow a non-Admin to test an agent provider', async () => {
    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.testAgentProvider({ agentProviderId: mockAgentProviderId })
    ).rejects.toThrow(TRPCError);
    expect(getAgentProvider).not.toHaveBeenCalled();
  });

  it('returns error when agent provider not found', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.testAgentProvider({
      agentProviderId: mockAgentProviderId,
    });

    expect(result).toEqual({
      text: '',
      isValid: false,
      errorMessage: 'Agent provider not found',
    });
  });

  it('handles fetch connection errors', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(mockAgentProvider);
    (fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.testAgentProvider({
      agentProviderId: mockAgentProviderId,
    });

    expect(result).toEqual({
      text: '',
      isValid: false,
      errorMessage: 'Connection refused',
    });
    expect(logger.error).toHaveBeenCalledWith(
      '[AGENT-PROVIDER/test] Connection failed to Test Agent',
      expect.any(Error)
    );
  });

  it('handles non-Error fetch failures', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(mockAgentProvider);
    (fetch as jest.Mock).mockRejectedValue('Network error');

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.testAgentProvider({
      agentProviderId: mockAgentProviderId,
    });

    expect(result).toEqual({
      text: '',
      isValid: false,
      errorMessage: 'Service unreachable',
    });
  });

  it('handles HTTP error responses with plain text', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(mockAgentProvider);
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    });

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.testAgentProvider({
      agentProviderId: mockAgentProviderId,
    });

    expect(result).toEqual({
      text: '',
      isValid: false,
      errorMessage: 'Internal server error',
    });
  });

  it('handles HTTP error responses with JSON detail', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(mockAgentProvider);
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ detail: 'Not Found' }),
    });

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.testAgentProvider({
      agentProviderId: mockAgentProviderId,
    });

    expect(result).toEqual({
      text: '',
      isValid: false,
      errorMessage: 'Not Found',
    });
  });

  it('handles HTTP error responses without parseable text', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(mockAgentProvider);
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.testAgentProvider({
      agentProviderId: mockAgentProviderId,
    });

    expect(result).toEqual({
      text: '',
      isValid: false,
      errorMessage: 'HTTP 404',
    });
  });

  it('handles unexpected errors during test', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(mockAgentProvider);
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('JSON parse error');
      },
    });

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.testAgentProvider({
      agentProviderId: mockAgentProviderId,
    });

    expect(result).toEqual({
      text: '',
      isValid: false,
      errorMessage: 'JSON parse error',
    });
    expect(logger.error).toHaveBeenCalledWith(
      '[AGENT-PROVIDER/test] test failed',
      expect.any(Error)
    );
  });

  it('handles non-Error unexpected errors', async () => {
    ctx.userRole = UserRole.Admin;
    (getAgentProvider as jest.Mock).mockResolvedValue(mockAgentProvider);
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => {
        throw 'Unknown error';
      },
    });

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.testAgentProvider({
      agentProviderId: mockAgentProviderId,
    });

    expect(result).toEqual({
      text: '',
      isValid: false,
      errorMessage: 'Internal server error',
    });
  });

  it('rejects invalid UUID format', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.testAgentProvider({ agentProviderId: 'invalid-uuid' })
    ).rejects.toThrow();
    expect(getAgentProvider).not.toHaveBeenCalled();
  });
});
