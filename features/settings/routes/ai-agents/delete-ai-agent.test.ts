import { AiAgentType } from '@/features/shared/types';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import deleteAiAgent from '@/features/settings/dal/ai-agents/deleteAiAgent';

jest.mock('@/features/settings/dal/ai-agents/deleteAiAgent');

describe('deleteAiAgent route', () => {
  let mockCtx: ContextType;

  const mockAgentId = '4078ecbd-5b6e-4445-a537-d3f8a34107ab';

  const mockAgent = {
    id: mockAgentId,
    name: 'Test Agent',
    description: 'This is a test agent',
    type: AiAgentType.CERTA,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (deleteAiAgent as jest.Mock).mockResolvedValue(mockAgent);

    mockCtx = {
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should call the delete dal with the input id', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    await caller.deleteAiAgent({ agentId: mockAgentId });

    expect(deleteAiAgent).toHaveBeenCalledWith(mockAgentId);
  });

  it('should return the deleted agent', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.deleteAiAgent({ agentId: mockAgentId });

    expect(result).toEqual({
      id: mockAgent.id,
      name: mockAgent.name,
      description: mockAgent.description,
      type: mockAgent.type,
    });
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.deleteAiAgent({ agentId: mockAgentId })).rejects.toThrow('You do not have permission to access this resource');
  });
});
