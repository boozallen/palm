import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import chatRouter from '@/features/chat/routes';
import getOriginPrompt from '@/features/chat/dal/getOriginPrompt';

jest.mock('@/features/chat/dal/getOriginPrompt');

const mockUserId = '570e3594-0ff3-475d-9ee0-4be261e6b8db';
const mockPromptId = 'fcc14cff-37ba-42bb-8d83-c5618d25acd3';

const mockGetOriginPromptResolvedValue = {
  id: mockPromptId,
  title: 'Sample Title',
  description: 'Sample Description',
  instructions: 'Sample Instructions',
  example: 'Sample Example',
  creatorId: mockUserId,
};

describe('getOriginPrompt procedure', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getOriginPrompt as jest.Mock).mockResolvedValue(mockGetOriginPromptResolvedValue);

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      logger: logger,
    } as unknown as ContextType;
  });

  it('returns the prompt successfully', async () => {
    const input = { promptId: mockPromptId };
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.getOriginPrompt(input);

    expect(result).toEqual({
      prompt: {
        id: mockGetOriginPromptResolvedValue.id,
        title: mockGetOriginPromptResolvedValue.title,
        description: mockGetOriginPromptResolvedValue.description,
        instructions: mockGetOriginPromptResolvedValue.instructions,
        example: mockGetOriginPromptResolvedValue.example,
      },
    });
  });

  it('throws error if user does not own prompt and is not an admin', async () => {
    ctx.userId = 'some-other-user-id';
    const input = { promptId: mockPromptId };
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.getOriginPrompt(input)).rejects.toThrow('You do not have permission to view this prompt');

    expect(logger.error).toHaveBeenCalledWith(
      `You do not have permission to view this prompt: userId: ${ctx.userId}, promptId: ${mockPromptId}`
    );
  });

  it('returns prompt if user is an admin', async () => {
    ctx.userRole = UserRole.Admin;
    ctx.userId = 'some-other-user-id';
    const input = { promptId: mockPromptId };
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.getOriginPrompt(input);

    expect(result).toEqual({
      prompt: {
        id: mockGetOriginPromptResolvedValue.id,
        title: mockGetOriginPromptResolvedValue.title,
        description: mockGetOriginPromptResolvedValue.description,
        instructions: mockGetOriginPromptResolvedValue.instructions,
        example: mockGetOriginPromptResolvedValue.example,
      },
    });
  });

  it('throws error if prompt retrieval fails', async () => {
    (getOriginPrompt as jest.Mock).mockRejectedValue(new Error('Database error'));
    const input = { promptId: mockPromptId };
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.getOriginPrompt(input)).rejects.toThrow('Database error');
  });
});
