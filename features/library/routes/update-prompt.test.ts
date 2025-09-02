import { ContextType } from '@/server/trpc-context';
import { Prompt } from '@/features/shared/types';
import { UserRole } from '@/features/shared/types/user';
import libraryRouter from '@/features/library/routes';
import getPrompt from '@/features/library/dal/getPrompt';
import updatePrompt from '@/features/library/dal/updatePrompt';
import logger from '@/server/logger';

jest.mock('@/features/library/dal/getPrompt');
jest.mock('@/features/library/dal/updatePrompt');

type InputType = {
  id: string;
  title: string;
  summary: string;
  description: string;
  instructions: string;
  example: string;
  model: string;
  randomness: number;
  repetitiveness: number;
  tags: string[];
};

describe('UpdatePromptRoute', () => {
  const mockUserId = 'c6fc8fc5-9e76-4851-9039-808f9b9035ca';
  const mockPromptId = '8da6ad20-92fc-4737-8650-39926f4f8cba';

  let ctx: ContextType;

  let mockInput: InputType;
  let mockGetPromptReturn: Prompt;
  let mockUpdatePromptReturn: Prompt;

  beforeEach(() => {
    jest.resetAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;

    mockInput = {
      id: mockPromptId,
      title: 'New title',
      summary: 'New summary',
      description: 'New description',
      instructions: 'New instructions',
      example: 'New example',
      model: 'New model',
      randomness: 0.7,
      repetitiveness: 0.7,
      tags: ['new-tag-1', 'new-tag-2'],
    };

    mockGetPromptReturn = {
      id: mockPromptId,
      creatorId: null,
      title: 'title',
      summary: 'summary',
      description: 'description',
      instructions: 'instructions',
      example: 'example',
      tags: ['tag1', 'tag2'],
      config: {
        model: 'model',
        randomness: 0.5,
        repetitiveness: 0.5,
      },
    };

    mockUpdatePromptReturn = {
      id: mockPromptId,
      creatorId: null,
      title: 'New title',
      summary: 'New summary',
      description: 'New description',
      instructions: 'New instructions',
      example: 'New example',
      tags: ['new-tag-1', 'new-tag-2'],
      config: {
        model: 'New model',
        randomness: 0.7,
        repetitiveness: 0.7,
      },
    };
  });

  it('lets an admin update a prompt', async () => {
    ctx.userRole = UserRole.Admin;

    (getPrompt as jest.Mock).mockResolvedValue(mockGetPromptReturn);
    (updatePrompt as jest.Mock).mockResolvedValue(mockUpdatePromptReturn);

    const caller = libraryRouter.createCaller(ctx);
    await expect(caller.updatePrompt(mockInput)).resolves.toEqual(mockUpdatePromptReturn);

    expect(updatePrompt).toBeCalledWith(mockInput);
  });

  it('lets a creator update their own prompt', async () => {
    mockGetPromptReturn.creatorId = mockUserId;

    (getPrompt as jest.Mock).mockResolvedValue(mockGetPromptReturn);
    (updatePrompt as jest.Mock).mockResolvedValue(mockUpdatePromptReturn);

    const caller = libraryRouter.createCaller(ctx);
    await expect(caller.updatePrompt(mockInput)).resolves.toEqual(mockUpdatePromptReturn);

    expect(updatePrompt).toBeCalledWith(mockInput);
  });

  it('throws error if user is not prompt creator or an admin', async () => {
    (getPrompt as jest.Mock).mockResolvedValue(mockGetPromptReturn);

    const caller = libraryRouter.createCaller(ctx);
    await expect(caller.updatePrompt(mockInput)).rejects.toThrow('You do not have permission to edit this prompt.');
    expect(logger.error).toHaveBeenCalled();

    expect(updatePrompt).not.toBeCalled();
  });
});
