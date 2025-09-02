import { UserRole } from '@/features/shared/types/user';
import getAvailablePolicies from '@/features/ai-agents/dal/certa/getAvailablePolicies';
import getAvailablePoliciesRoute from '@/features/ai-agents/routes/certa/get-available-policies';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';

jest.mock('@/features/ai-agents/dal/certa/getAvailablePolicies');
jest.mock('@/features/shared/dal/getAvailableAgents');

describe('getAvailablePolicies route', () => {
  const mockPolicies = [
    {
      id: '0660f08f-f682-43d6-8a43-36fa15edde95',
      title: 'Test Policy 1',
      content: 'Content for test policy 1',
      requirements: 'Requirements for test policy 1',
    },
    {
      id: '884f673e-6da3-4d40-8436-ad48bf1b4bce',
      title: 'Test Policy 2',
      content: 'Content for test policy 2',
      requirements: 'Requirements for test policy 2',
    },
  ];

  const mockError = new Error('Error fetching policies for dropdown');

  const testRouter = router({
    getAvailablePolicies: getAvailablePoliciesRoute,
  });

  const mockGetAvailableAgents = getAvailableAgents as jest.Mock;

  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (getAvailablePolicies as jest.Mock).mockResolvedValue(mockPolicies);
    mockGetAvailableAgents.mockResolvedValue([
      { id: 'test-agent-id' },
    ]);
    mockCtx = {
      userId: 'test-user-id',
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should return available policies with default parameters', async () => {
    const agentId = 'test-agent-id';
    const caller = testRouter.createCaller(mockCtx);
    const result = await caller.getAvailablePolicies({ agentId });

    expect(result).toEqual({
      policies: mockPolicies.map(policy => ({
        id: policy.id,
        title: policy.title,
        content: policy.content,
        requirements: policy.requirements,
      })),
    });

    expect(getAvailablePolicies).toHaveBeenCalledWith('test-user-id', agentId, undefined, 10);
  });

  it('should handle search parameter', async () => {
    const agentId = 'test-agent-id';
    const searchTerm = 'test';

    const caller = testRouter.createCaller(mockCtx);
    const result = await caller.getAvailablePolicies({ agentId, search: searchTerm });

    expect(result).toEqual({
      policies: mockPolicies.map(policy => ({
        id: policy.id,
        title: policy.title,
        content: policy.content,
        requirements: policy.requirements,
      })),
    });

    expect(getAvailablePolicies).toHaveBeenCalledWith('test-user-id', agentId, searchTerm, 10);
  });

  it('should handle limit parameter', async () => {
    const agentId = 'test-agent-id';
    const limit = 5;

    const caller = testRouter.createCaller(mockCtx);
    const result = await caller.getAvailablePolicies({ agentId, limit });

    expect(result).toEqual({
      policies: mockPolicies.map(policy => ({
        id: policy.id,
        title: policy.title,
        content: policy.content,
        requirements: policy.requirements,
      })),
    });

    expect(getAvailablePolicies).toHaveBeenCalledWith('test-user-id', agentId, undefined, limit);
  });

  it('should handle both search and limit parameters', async () => {
    const agentId = 'test-agent-id';
    const searchTerm = 'test';
    const limit = 5;

    const caller = testRouter.createCaller(mockCtx);
    const result = await caller.getAvailablePolicies({ agentId, search: searchTerm, limit });

    expect(result).toEqual({
      policies: mockPolicies.map(policy => ({
        id: policy.id,
        title: policy.title,
        content: policy.content,
        requirements: policy.requirements,
      })),
    });

    expect(getAvailablePolicies).toHaveBeenCalledWith('test-user-id', agentId, searchTerm, limit);
  });

  it('should handle errors from getAvailablePolicies', async () => {
    const agentId = 'test-agent-id';
    (getAvailablePolicies as jest.Mock).mockRejectedValue(mockError);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getAvailablePolicies({ agentId })).rejects.toThrow(
      'Error fetching policies for dropdown'
    );

    expect(getAvailablePolicies).toHaveBeenCalledWith('test-user-id', agentId, undefined, 10);
  });

  it('should throw error if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getAvailablePolicies({ agentId: 'non-existent-agent' })).rejects.toThrow(
      'You do not have permission to access this resource'
    );

    expect(getAvailablePolicies).not.toHaveBeenCalled();
  });
});
