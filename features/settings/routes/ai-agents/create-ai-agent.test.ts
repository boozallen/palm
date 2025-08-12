import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import createAiAgent from '@/features/settings/dal/ai-agents/createAiAgent';
import { TRPCError } from '@trpc/server';
import { ContextType } from '@/server/trpc-context';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/settings/dal/ai-agents/createAiAgent', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('create-ai-agent', () => {
  const mockAgent = {
    id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
    name: 'Test Agent',
    description: 'This is a test AI agent',
    type: AiAgentType.CERTA,
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: 'f48c262b-435c-47db-97f2-5f7e4c3b34a6',
      userRole: UserRole.User,
      prisma: {
        aiAgent: {
          create: jest.fn(),
        },
      },
    } as unknown as ContextType;
  });

  it('allows a UserRole.Admin user to add a new Ai Agent', async () => {
    ctx.userRole = UserRole.Admin;

    (createAiAgent as jest.Mock).mockResolvedValue(mockAgent);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createAiAgent(mockAgent)).resolves.toEqual({
      id: mockAgent.id,
      name: mockAgent.name,
      description: mockAgent.description,
      type: mockAgent.type,
    });
    expect(createAiAgent).toHaveBeenCalledWith({
      name: mockAgent.name,
      description: mockAgent.description,
      type: mockAgent.type,
    });
  });

  it('does not allow a UserRole.User user to add an Ai Agent', async () => {
    const error = new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You do not have permission to create an AI agent.',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createAiAgent(mockAgent)).rejects.toThrow(error);
    expect(createAiAgent).not.toHaveBeenCalled();
  });

  it('should throw an error when the DAL throws an error', async () => {
    ctx.userRole = UserRole.Admin;
    const errorMessage = 'Error adding AI agent';
    (createAiAgent as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createAiAgent(mockAgent)).rejects.toThrow(errorMessage);
    expect(createAiAgent).toHaveBeenCalledWith({
      name: mockAgent.name,
      description: mockAgent.description,
      type: mockAgent.type,
    });
  });
});
