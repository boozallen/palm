import { MessageRole } from '@/features/chat/types/message';

// the openai module *must* be mocked with a replacement
// doing a simple `jest.mock('openai`)` here won't work
jest.mock('openai', () => {
  return {
    default: jest.fn(),
    __esModule: true,
  };
});
const mockChatCreate = jest.fn();
const mockEmbeddingsCreate = jest.fn();

import OpenAI from 'openai';
import { OpenAiSource } from './openai';

// Get the mocked constructor
const mockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

// default aiSettings to use when specific values aren't required
const aiSettings = { randomness: 0, model: 'gpt-4o', repetitiveness: 0 };

describe('OpenAiSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAI.mockImplementation(
      () =>
        ({
          chat: { completions: { create: mockChatCreate } },
          embeddings: { create: mockEmbeddingsCreate },
        }) as unknown as OpenAI,
    );
  });

  describe('completion', () => {
    it('returns correct values from basic API call', async () => {
      // Set up the mock implementation
      mockChatCreate.mockResolvedValue({
        // Mock whatever response structure you expect from OpenAI
        choices: [
          {
            message: {
              content: 'Mock response content',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 20,
          total_tokens: 30,
        },
      });

      const openAiSource = new OpenAiSource('');
      const result = openAiSource.completion('test prompt', aiSettings);

      // Assertions
      expect(mockChatCreate).toHaveBeenCalled();
      // Add your expectations about what doSomething() should return
      await expect(result).resolves.toEqual({
        text: 'Mock response content',
        inputTokensUsed: 20,
        outputTokensUsed: 10,
      });
    });

    it('should handle errors from OpenAI', async () => {
      // Set up mock to throw an error
      mockChatCreate.mockRejectedValue(new Error('API error'));

      const openAiSource = new OpenAiSource('');

      // Test error handling in doSomething()
      const result = openAiSource.completion('test prompt', aiSettings);
      await expect(result).rejects.toThrow(
        'Unable to retrieve response from the AI provider',
      );
    });

    it('should throw an error if API returns no choices', async () => {
      mockChatCreate.mockResolvedValue({
        // Mock whatever response structure you expect from OpenAI
        choices: [],
        usage: {
          prompt_tokens: 20,
          total_tokens: 30,
        },
      });

      const openAiSource = new OpenAiSource('');
      const result = openAiSource.completion('test prompt', aiSettings);

      await expect(result).rejects.toThrow(
        'Unable to retrieve response from the AI provider',
      );
    });

    it('should throw an error if API returns no usage', async () => {
      mockChatCreate.mockResolvedValue({
        // Mock whatever response structure you expect from OpenAI
        choices: [
          {
            message: {
              content: 'Mock response content',
            },
            finish_reason: 'stop',
          },
        ],
      });

      const openAiSource = new OpenAiSource('');
      const result = openAiSource.completion('test prompt', aiSettings);

      await expect(result).rejects.toThrow(
        'Unable to retrieve response from the AI provider',
      );
    });

    it('should throw an error if API returns empty message', async () => {
      mockChatCreate.mockResolvedValue({
        // Mock whatever response structure you expect from OpenAI
        choices: [
          {
            message: {
              content: '',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 20,
          total_tokens: 30,
        },
      });

      const openAiSource = new OpenAiSource('');
      const result = openAiSource.completion('test prompt', aiSettings);

      await expect(result).rejects.toThrow(
        'Unable to retrieve response from the AI provider',
      );
    });
  });

  describe('chatCompletion', () => {
    it('returns correct values from basic API call', async () => {
      // Set up the mock implementation
      mockChatCreate.mockResolvedValue({
        // Mock whatever response structure you expect from OpenAI
        choices: [
          {
            message: {
              content: 'Mock response content',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 20,
          total_tokens: 30,
        },
      });

      const openAiSource = new OpenAiSource('');
      const result = openAiSource.chatCompletion(
        [{ role: MessageRole.User, content: 'hello' }],
        aiSettings,
      );

      // Assertions
      expect(mockChatCreate).toHaveBeenCalled();
      // Add your expectations about what doSomething() should return
      await expect(result).resolves.toEqual({
        text: 'Mock response content',
        inputTokensUsed: 20,
        outputTokensUsed: 10,
      });
    });

    it('should handle errors from OpenAI', async () => {
      // Set up mock to throw an error
      mockChatCreate.mockRejectedValue(new Error('API error'));

      const openAiSource = new OpenAiSource('');

      // Test error handling in doSomething()
      await expect(openAiSource.chatCompletion([], aiSettings)).rejects.toThrow(
        /unknown error/,
      );
    });

    it('should throw an error if API returns no choices', async () => {
      mockChatCreate.mockResolvedValue({
        // Mock whatever response structure you expect from OpenAI
        choices: [],
        usage: {
          prompt_tokens: 20,
          total_tokens: 30,
        },
      });

      const openAiSource = new OpenAiSource('');
      const result = openAiSource.chatCompletion(
        [{ role: MessageRole.User, content: 'hello' }],
        aiSettings,
      );

      await expect(result).rejects.toThrow(
        'An unknown error occurred, please try again later',
      );
    });

    it('should throw an error if API returns no usage', async () => {
      mockChatCreate.mockResolvedValue({
        // Mock whatever response structure you expect from OpenAI
        choices: [
          {
            message: {
              content: 'Mock response content',
            },
            finish_reason: 'stop',
          },
        ],
      });

      const openAiSource = new OpenAiSource('');
      const result = openAiSource.chatCompletion(
        [{ role: MessageRole.User, content: 'hello' }],
        aiSettings,
      );

      await expect(result).rejects.toThrow(
        'An unknown error occurred, please try again later',
      );
    });

    it('should throw an error if API returns empty message', async () => {
      mockChatCreate.mockResolvedValue({
        // Mock whatever response structure you expect from OpenAI
        choices: [
          {
            message: {
              content: '',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 20,
          total_tokens: 30,
        },
      });

      const openAiSource = new OpenAiSource('');
      const result = openAiSource.chatCompletion(
        [{ role: MessageRole.User, content: 'hello' }],
        aiSettings,
      );

      await expect(result).rejects.toThrow(
        'An unknown error occurred, please try again later',
      );
    });
  });

  describe('createEmbeddings', () => {
    it('shuld provide an embedding for each output', async () => {
      mockEmbeddingsCreate.mockResolvedValue({
        data: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        usage: {
          prompt_tokens: 20,
          total_tokens: 30,
        },
      });
      const aiSource = new OpenAiSource('');
      try {
        const result = await aiSource.createEmbeddings(
          ['one two three', 'four five six'],
          aiSettings,
        );
        expect(result.embeddings?.length).toBe(2);
      } catch (error) {
        fail('Call to createEmbedings rejected unexpectedly: ' + error);
      }
    });

    it('should handle errors from the API', async () => {
      mockEmbeddingsCreate.mockRejectedValue(new Error('API error'));
      const aiSource = new OpenAiSource('');
      const result = aiSource.createEmbeddings(['test'], aiSettings);
      expect(result).rejects.toThrow(
        'Unable to retrieve response from the AI provider',
      );
    });
  });
});
