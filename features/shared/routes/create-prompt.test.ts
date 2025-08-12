import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import createPrompt from '@/features/shared/dal/createPrompt';
import sharedRouter from '@/features/shared/routes/index';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import { Prompt } from '@/features/shared/types';

jest.mock('@/features/shared/dal/createPrompt');

describe('createPromptRoute', () => {
  const mockUserId = 'a1ef51cd-49d7-440b-868f-d674791d3c32';

  const mockInput = {
    prompt: {
      creatorId: 'a1ef51cd-49d7-440b-868f-d674791d3c32',
      title: 'Mock Prompt',
      summary: 'Mock Summary',
      description: 'Mock Description',
      instructions: 'Mock Instructions',
      example: 'Mock Example',
      tags: ['tag1', 'tag2'],
      config: {
        bestOf: 0.5,
        frequencyPenalty: 0.5,
        model: 'gpt-4',
        presencePenalty: 0.5,
        randomness: 0.5,
        repetitiveness: 0.5,
      },
    },
  };

  const mockCreatePromptResolvedValue: Prompt = {
    id: 'd7164c5f-ccd4-4a13-aa0c-4df7548f991a',
    creatorId: 'a1ef51cd-49d7-440b-868f-d674791d3c32',
    title: 'Mock Prompt',
    summary: 'Mock Summary',
    description: 'Mock Description',
    instructions: 'Mock Instructions',
    example: 'Mock Example',
    tags: ['tag1', 'tag2'],
    config: {
      randomness: 0.5,
      model: 'gpt-4',
      repetitiveness: 0.5,
      bestOf: 0.5,
      presencePenalty: 0.5,
      frequencyPenalty: 0.5,
    },
  };

  let ctx: ContextType;
  beforeEach(() => {
    jest.clearAllMocks();

    (createPrompt as jest.Mock).mockResolvedValue(
      mockCreatePromptResolvedValue
    );
  });

  it('should create prompt with valid user context', async () => {
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.createPrompt(mockInput)).resolves.toEqual({
      prompt: mockCreatePromptResolvedValue,
    });

    expect(createPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.objectContaining({
          creatorId: ctx.userId,
        }),
      })
    );
  });

  it('should fail if user does not exist', async () => {
    ctx = {
      userId: null,
    } as unknown as ContextType;
    const mockError = Unauthorized(
      'You do not have permission to access this resource'
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.createPrompt(mockInput)).rejects.toThrow(mockError);
    expect(createPrompt).not.toHaveBeenCalled();
  });
});
