import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getAiAgents from '@/features/settings/dal/ai-agents/getAiAgents';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/settings/dal/ai-agents/getAiAgents');

describe('getAiAgents route', () => {
  const mockAgents = [
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
      label: 'Agent 1',
      description: 'Description 1',
      type: AiAgentType.CERTA,
    },
    {
      id: '20e0eba0-b782-491b-b609-b5c84cb0e17a',
      label: 'Agent 2',
      description: 'Description 2',
      type: AiAgentType.RADAR,
    },
  ];

  const mockError = Forbidden('You do not have permission to access this resource.');

  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (getAiAgents as jest.Mock).mockResolvedValue(mockAgents);
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should return agents if user is Admin', async () => {
    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getAiAgents();

    expect(result).toEqual({
      aiAgents: mockAgents,
    });

    expect(getAiAgents).toHaveBeenCalled();
  });

  it('should throw an error if user is not Admin', async () => {
    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getAiAgents()).rejects.toThrow(mockError);

    expect(getAiAgents).not.toHaveBeenCalled();
  });

  it('should handle errors from getAiAgents', async () => {
    const mockDbError = new Error('Database error');
    (getAiAgents as jest.Mock).mockRejectedValue(mockDbError);

    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getAiAgents()).rejects.toThrow('Database error');

    expect(getAiAgents).toHaveBeenCalled();
  });
});
