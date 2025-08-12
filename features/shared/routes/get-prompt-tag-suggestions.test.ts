import { ContextType } from '@/server/trpc-context';
import { PromptFormValues } from '@/features/shared/types';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import sharedRouter from '@/features/shared/routes';
import getMostCommonPromptTags from '@/features/shared/dal/getMostCommonPromptTags';
import generatePromptTagSuggestions from '@/features/shared/system-ai/generatePromptTagSuggestions';

jest.mock('@/features/shared/dal/getMostCommonPromptTags');
jest.mock('@/features/shared/system-ai/generatePromptTagSuggestions');

describe('get-prompt-tag-suggestions route', () => {

  const mockPrompt: PromptFormValues = {
    creatorId: null,
    title: 'prompt-title',
    summary: 'prompt-summary',
    description: 'prompt-description',
    instructions: 'prompt-instructions',
    example: 'prompt-example',
    tags: ['tag-one', 'tag-two', 'tag-three'],
    config: {
      model: 'test-model',
      randomness: 0.5,
      repetitiveness: 0.5,
    },
  };
  const mockPromptTagSuggestions = {
    tags: ['code-analysis', 'optimization', 'code-generation'],
  };
  const mockUnauthorized = Unauthorized('You do not have permission to access this resource');

  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCtx = {
      ai: jest.fn(),
      userId: 'test-user-id',
    } as unknown as ContextType;

    (getMostCommonPromptTags as jest.Mock).mockResolvedValue(['common-tag-1', 'common-tag-2']);
  });

  it('returns prompt tag suggestions', async () => {
    (generatePromptTagSuggestions as jest.Mock).mockResolvedValue(mockPromptTagSuggestions);

    const caller = sharedRouter.createCaller(mockCtx);
    const response = await caller.getPromptTagSuggestions({ prompt: mockPrompt });

    expect(response).toEqual({
      tags: mockPromptTagSuggestions.tags,
    });
  });

  it('throws an error if the generatePromptTagSuggestions system-ai function fails', async () => {
    const mockError = new Error('Error generating prompt tag suggestions');
    (generatePromptTagSuggestions as jest.Mock).mockRejectedValue(mockError);

    const caller = sharedRouter.createCaller(mockCtx);

    await expect(
      caller.getPromptTagSuggestions({ prompt: mockPrompt })
    ).rejects.toThrow(mockError.message);
  });

  it('throws an Unauthorized error if no user session', async () => {
    mockCtx = {
      userId: null,
    } as unknown as ContextType;

    const caller = sharedRouter.createCaller(mockCtx);

    await expect(
      caller.getPromptTagSuggestions({ prompt: mockPrompt })
    ).rejects.toThrow(mockUnauthorized);

    expect(generatePromptTagSuggestions).not.toHaveBeenCalled();
  });
});
