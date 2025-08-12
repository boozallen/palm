import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import getAiAgent from '@/features/settings/dal/ai-agents/getAiAgent';
import logger from '@/server/logger';

jest.mock('@/libs/featureFlags');
jest.mock('@/features/settings/dal/ai-agents/getAiAgent');

const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
const mockAgent = {
  id: mockAgentId,
  name: 'Test Agent',
  description: 'This is a test agent',
};

describe('getAiAgent route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getAiAgent as jest.Mock).mockResolvedValue(mockAgent);

    mockCtx = {
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return agent if user is Admin', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getAiAgent({ id: mockAgentId });

    expect(result).toEqual(mockAgent);

    expect(getAiAgent).toHaveBeenCalled();
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getAiAgent({ id: mockAgentId })).rejects.toThrow();

    expect(getAiAgent).not.toHaveBeenCalled();
  });

  it('should handle errors from getAiAgent', async () => {
    const mockDalError = new Error('Database error');
    (getAiAgent as jest.Mock).mockRejectedValue(mockDalError);

    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getAiAgent({ id: mockAgentId })).rejects.toThrow();

    expect(getAiAgent).toHaveBeenCalled();
  });
});
