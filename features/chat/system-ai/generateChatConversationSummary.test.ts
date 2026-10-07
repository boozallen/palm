import generateChatConversationSummary, {
  classifyChatUseCase,
  classifyUseCasePrompt,
  summarizePrompt,
  titlePrompt,
} from './generateChatConversationSummary';
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

  it('should generate a chat conversation summary and use case successfully', async () => {
    mockAISource.source.completion.mockResolvedValue({
      text: '{"summary": "Test Summary", "useCase": "Engineering"}',
    });

    const result = await generateChatConversationSummary(mockAIFactory, mockMessages);
    const mockPrompt = summarizePrompt(mockMessages[0].content, mockMessages[1].content);

    expect(result).toEqual({ summary: 'Test Summary', useCase: 'Engineering' });
    expect(mockAIFactory.buildSystemSource).toHaveBeenCalled();
    expect(mockAISource.source.completion).toHaveBeenCalledWith(mockPrompt, {
      model: 'test-model',
      temperature: 0.2,
      topP: 0.5,
    });
  });

  it('should return null summary and useCase if the response has no JSON object', async () => {
    mockAISource.source.completion.mockResolvedValue({ text: 'not json' });

    const result = await generateChatConversationSummary(mockAIFactory, mockMessages);

    expect(result).toEqual({ summary: null, useCase: null });
  });

  // The regression this change exists to prevent: the caller that titles a new chat
  // holds an assistant message with empty content, and categorizing that produced a
  // category derived from the request alone, skewing the Value tab toward Trial Test.
  describe('when the assistant has not replied yet', () => {
    const unanswered = [
      mockMessages[0],
      { ...mockMessages[1], content: '' },
    ];

    it('asks for a title only, without the empty assistant message', async () => {
      mockAISource.source.completion.mockResolvedValue({
        text: '{"summary": "Test Summary"}',
      });

      await generateChatConversationSummary(mockAIFactory, unanswered);

      expect(mockAISource.source.completion).toHaveBeenCalledWith(
        titlePrompt(mockMessages[0].content),
        expect.anything(),
      );
    });

    it('returns the title and no use case', async () => {
      mockAISource.source.completion.mockResolvedValue({
        text: '{"summary": "Test Summary"}',
      });

      const result = await generateChatConversationSummary(mockAIFactory, unanswered);

      expect(result).toEqual({ summary: 'Test Summary', useCase: null });
    });

    // The prompt never asked for one, so anything here was volunteered — which is the
    // guess being eliminated.
    it('discards a use case the model volunteers anyway', async () => {
      mockAISource.source.completion.mockResolvedValue({
        text: '{"summary": "Test Summary", "useCase": "Trial Test"}',
      });

      const result = await generateChatConversationSummary(mockAIFactory, unanswered);

      expect(result).toEqual({ summary: 'Test Summary', useCase: null });
    });

    it('treats whitespace as no reply', async () => {
      mockAISource.source.completion.mockResolvedValue({
        text: '{"summary": "Test Summary"}',
      });

      const result = await generateChatConversationSummary(mockAIFactory, [
        mockMessages[0],
        { ...mockMessages[1], content: '   \n  ' },
      ]);

      expect(result).toEqual({ summary: 'Test Summary', useCase: null });
    });
  });

  describe('classifyChatUseCase', () => {
    // The chat already has a title by the time this runs, so asking for another one
    // would spend output tokens on a string the caller throws away.
    it('asks for a category only, with no title in the contract', async () => {
      mockAISource.source.completion.mockResolvedValue({
        text: '{"useCase": "Engineering"}',
      });

      await classifyChatUseCase(mockAIFactory, 'User Message', 'Assistant Message');

      expect(mockAISource.source.completion).toHaveBeenCalledWith(
        classifyUseCasePrompt('User Message', 'Assistant Message'),
        expect.anything(),
      );
      expect(classifyUseCasePrompt('User Message', 'Assistant Message')).not.toContain('summary');
    });

    it('returns the category', async () => {
      mockAISource.source.completion.mockResolvedValue({
        text: '{"useCase": "Engineering"}',
      });

      const result = await classifyChatUseCase(mockAIFactory, 'User Message', 'Assistant Message');

      expect(result).toEqual('Engineering');
    });

    it('returns null when the response has no JSON object', async () => {
      mockAISource.source.completion.mockResolvedValue({ text: 'not json' });

      const result = await classifyChatUseCase(mockAIFactory, 'User Message', 'Assistant Message');

      expect(result).toBeNull();
    });

    // Left to assignChatUseCase, which logs with the chat id attached and owns the
    // decision that a failed classification is survivable.
    it('throws rather than swallowing a provider failure', async () => {
      const expectedError = new Error('Test error');
      mockAISource.source.completion.mockRejectedValue(expectedError);

      await expect(
        classifyChatUseCase(mockAIFactory, 'User Message', 'Assistant Message'),
      ).rejects.toThrow(expectedError);
    });

    // Both the classify and the title paths must stay reproducible, so the settings
    // live in one shared place rather than at each call site.
    it('uses the same deterministic settings as the summary call', async () => {
      mockAISource.source.completion.mockResolvedValue({
        text: '{"useCase": "Engineering"}',
      });

      await classifyChatUseCase(mockAIFactory, 'User Message', 'Assistant Message');

      expect(mockAISource.source.completion).toHaveBeenCalledWith(expect.anything(), {
        model: 'test-model',
        temperature: 0.2,
        topP: 0.5,
      });
    });
  });

  it('should return null summary and useCase on error', async () => {
    const expectedError = new Error('Test error');
    mockAISource.source.completion.mockRejectedValue(expectedError);

    const result = await generateChatConversationSummary(mockAIFactory, mockMessages);

    expect(result).toEqual({ summary: null, useCase: null });
    expect(logger.error).toHaveBeenCalledWith(
      'Error generating chat conversation summary:',
      expectedError
    );
  });
});
