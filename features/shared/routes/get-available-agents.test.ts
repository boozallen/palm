import { UserRole } from '@/features/shared/types/user';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import { AiAgentType } from '@/features/shared/types/ai-agent';

jest.mock('@/features/shared/dal/getAvailableAgents');

describe('getAvailableAgents route', () => {
  const mockAgents = [
    {
      id: '0660f08f-f682-43d6-8a43-36fa15edde95',
      name: 'Test Agent 1',
      description: 'Description for test agent 1',
      type: AiAgentType.CERTA,
    },
    {
      id: '884f673e-6da3-4d40-8436-ad48bf1b4bce',
      name: 'Test Agent 2',
      description: 'Description for test agent 2',
      type: AiAgentType.RADAR,
    },
  ];

  const mockError = new Error('Failed to fetch agents');

  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (getAvailableAgents as jest.Mock).mockResolvedValue(mockAgents);
    mockCtx = {
      userId: 'test-user-id',
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should return available agents', async () => {
    const caller = sharedRouter.createCaller(mockCtx);
    const result = await caller.getAvailableAgents();

    expect(result).toEqual({
      availableAgents: mockAgents,
    });

    expect(getAvailableAgents).toHaveBeenCalledWith('test-user-id');
  });

  it('should handle errors from getAvailableAgents', async () => {
    (getAvailableAgents as jest.Mock).mockRejectedValue(mockError);

    const caller = sharedRouter.createCaller(mockCtx);

    await expect(caller.getAvailableAgents()).rejects.toThrow(
      'Failed to fetch agents'
    );

    expect(getAvailableAgents).toHaveBeenCalledWith('test-user-id');
  });
});
