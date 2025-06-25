import getUserEnabledAiAgents from '@/features/shared/dal/getUserEnabledAiAgents';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import sharedRouter from '@/features/shared/routes';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/shared/dal/getUserEnabledAiAgents');

describe('get-user-enabled-ai-agents procedure', () => {
  const mockEnabledAiAgents = [
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
      name: 'Chat Assistant',
      description: 'AI agent for general chat assistance',
      enabled: true,
    },
    {
      id: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
      name: 'Code Helper',
      description: 'AI agent for code assistance',
      enabled: true,
    },
  ];
  const mockUserId = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

  const mockError = Unauthorized('You do not have permission to access this resource');
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;

    (getUserEnabledAiAgents as jest.Mock).mockResolvedValue(mockEnabledAiAgents);
  });

  it('should fail if there is no user session', async () => {
    ctx = {
      userId: null,
    } as unknown as ContextType;

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getUserEnabledAiAgents()).rejects.toThrow(mockError);

    expect(getUserEnabledAiAgents).not.toHaveBeenCalled();
  });

  it('should get all enabled AI agents for a user', async () => {
    const caller = sharedRouter.createCaller(ctx);

    const result = await caller.getUserEnabledAiAgents();

    expect(result).toEqual({
      enabledAiAgents: mockEnabledAiAgents,
    });

    expect(getUserEnabledAiAgents).toHaveBeenCalledWith(mockUserId);
  });

  it('should return empty array when user has no enabled agents', async () => {
    (getUserEnabledAiAgents as jest.Mock).mockResolvedValue([]);

    const caller = sharedRouter.createCaller(ctx);

    const result = await caller.getUserEnabledAiAgents();

    expect(result).toEqual({
      enabledAiAgents: [],
    });

    expect(getUserEnabledAiAgents).toHaveBeenCalledWith(mockUserId);
  });
});
