import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getUserGroupAiAgents from '@/features/settings/dal/getUserGroupAiAgents';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/getUserGroupAiAgents');
jest.mock('@/features/settings/dal/getUserGroupMembership');

describe('getUserGroupAiAgents route', () => {
  const mockGroupId = '123e4567-e89b-12d3-a456-426614174000';
  const mockAgents = [
    {
      id: 'a23e4567-e89b-12d3-a456-426614174001',
      name: 'Agent 1',
      description: 'Description 1',
    },
    {
      id: 'b23e4567-e89b-12d3-a456-426614174002',
      name: 'Agent 2',
      description: 'Description 2',
    },
  ];

  const mockError = Forbidden('You do not have permission to access this resource');

  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (getUserGroupAiAgents as jest.Mock).mockResolvedValue(mockAgents);
    (getUserGroupMembership as jest.Mock).mockResolvedValue({
      role: UserGroupRole.Lead,
    });

    mockCtx = {
      userId: 'test-user-id',
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should return agents when user is an admin', async () => {
    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getUserGroupAiAgents({ userGroupId: mockGroupId });

    expect(result).toEqual({
      userGroupAiAgents: mockAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
      })),
    });

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(getUserGroupAiAgents).toHaveBeenCalledWith(mockGroupId);
  });

  it('should return agents when user is a group lead', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getUserGroupAiAgents({ userGroupId: mockGroupId });

    expect(result).toEqual({
      userGroupAiAgents: mockAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
      })),
    });

    expect(getUserGroupMembership).toHaveBeenCalledWith(mockCtx.userId, mockGroupId);
    expect(getUserGroupAiAgents).toHaveBeenCalledWith(mockGroupId);
  });

  it('should throw an error if user is not an admin or group lead', async () => {
    (getUserGroupMembership as jest.Mock).mockResolvedValue({
      role: UserGroupRole.User,
    });

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getUserGroupAiAgents({ userGroupId: mockGroupId })).rejects.toThrow(mockError);

    expect(getUserGroupMembership).toHaveBeenCalledWith(mockCtx.userId, mockGroupId);
    expect(getUserGroupAiAgents).not.toHaveBeenCalled();
  });

  it('should handle errors from getUserGroupAiAgents', async () => {
    const mockDbError = new Error('Database error');
    (getUserGroupAiAgents as jest.Mock).mockRejectedValue(mockDbError);

    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getUserGroupAiAgents({ userGroupId: mockGroupId })).rejects.toThrow('Database error');

    expect(getUserGroupAiAgents).toHaveBeenCalledWith(mockGroupId);
  });
});
