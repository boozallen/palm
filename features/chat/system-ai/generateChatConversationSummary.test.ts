import generateChatConversationSummary, { summarizePrompt } from './generateChatConversationSummary';
import { AIFactory } from '@/features/ai-provider';
import logger from '@/server/logger';

jest.mock('@/features/ai-provider');

const mockMessages = [
  {
    role: 'user',
    content: 'User Message',
    messagedAt: '2024-02-02T00:00:00.000Z',
  },
  {
    role: 'assistant',
    content: 'Assistant Message',
    messagedAt: '2024-02-02T00:00:00.000Z',
  },
];

describe('generateChatConversationSummary', () => {
  const mockAISource = {
    source: {
      completion: jest.fn(),
    },
    model: {
      externalId: 'test-model',
    },
  };
  const mockAIFactory = {
    buildSystemSource: jest.fn().mockResolvedValue(mockAISource),
  } as unknown as AIFactory;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate a chat conversation summary successfully', async () => {
    const expectedSummary = 'Test Summary';
    mockAISource.source.completion.mockResolvedValue({ text: expectedSummary });

    const result = await generateChatConversationSummary(mockAIFactory, mockMessages);
    const mockPrompt = summarizePrompt(mockMessages[0].content, mockMessages[1].content);

    expect(result).toEqual({ summary: expectedSummary });
    expect(mockAIFactory.buildSystemSource).toHaveBeenCalled();
    expect(mockAISource.source.completion).toHaveBeenCalledWith(mockPrompt, {
      model: 'test-model',
      randomness: 0.2,
      repetitiveness: 0.5,
    });
  });

  it('should return null summary if AI responds with an empty summary', async () => {
    const emptySummary = ' ';
    mockAISource.source.completion.mockResolvedValue({ text: emptySummary });

    const result = await generateChatConversationSummary(mockAIFactory, mockMessages);
    const mockPrompt = summarizePrompt(mockMessages[0].content, mockMessages[1].content);

    expect(result).toEqual({ summary: null });
    expect(mockAIFactory.buildSystemSource).toHaveBeenCalled();
    expect(mockAISource.source.completion).toHaveBeenCalledWith(mockPrompt, {
      model: 'test-model',
      randomness: 0.2,
      repetitiveness: 0.5,
    });
  });

  it('should return null summary on error', async () => {
    const expectedError = new Error('Test error');
    mockAISource.source.completion.mockRejectedValue(expectedError);

    const result = await generateChatConversationSummary(mockAIFactory, mockMessages);

    expect(result).toEqual({ summary: null });
    expect(logger.error).toHaveBeenCalledWith(
      'Error generating chat conversation summary:',
      expectedError
    );
  });
});
