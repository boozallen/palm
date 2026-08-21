import { ContextType } from '@/server/trpc-context';
import { PromptService } from '@/features/library/services/prompts';
import { AiResponse } from '@/features/ai-provider/sources/types';
import generatePrompt from '.'; // Assuming this is the router index

jest.mock('@/features/library/services/prompts');
jest.mock('@/features/shared/dal/getAvailableModels');

describe('generatePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAiResponse: AiResponse = {
    text: 'Hello world',
    inputTokensUsed: 14,
    outputTokensUsed: 23,
  };

  it('should call generatePrompt', async () => {
    const promptServiceMock = {
      generatePrompt: jest.fn().mockResolvedValue(mockAiResponse),
    };
    (PromptService as jest.Mock).mockImplementation(() => promptServiceMock);

    const mockInput = { prompt: 'test prompt' };
    const mockCtx = {
      ai: jest.fn(),
      userId: 'test-user-id',
    } as unknown as ContextType;

    const caller = generatePrompt.createCaller(mockCtx);
    const response = await caller.generatePrompt(mockInput);

    expect(promptServiceMock.generatePrompt).toHaveBeenCalledWith(
      'test prompt'
    );
    expect(response).toEqual(mockAiResponse);
  });
});
