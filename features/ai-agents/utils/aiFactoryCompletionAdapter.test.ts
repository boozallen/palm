import { BuildResult } from '@/features/ai-agents/types/factoryAdapter';
import { AiFactoryCompletionAdapter, MessageType } from './aiFactoryCompletionAdapter';
import { AiSettings } from '@/types/ai-settings';
import { MessageRole } from '@/features/chat/types/message';
import { ChatCompletionMessage } from '@/features/ai-provider/sources/types';

describe('AiFactoryCompletionAdapter', () => {
  let stubAi: BuildResult;
  const mockResponse = { text: 'mocked-response' };
  const completion = jest.fn();
  const chatCompletion = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    stubAi = {
      model: {
        externalId: 'stub-model-id',
      },
      source: {
        completion,
        chatCompletion,
      },
    } as unknown as BuildResult;
  });

  describe('get metadata', () => {
    it('should return the metadata with default settings', () => {
      const adapter = new AiFactoryCompletionAdapter(stubAi);
      expect(adapter.metadata).toEqual({
        model: stubAi.model.externalId,
        temperature: 0,
        topP: 1,
        contextWindow: 4096,
      });
    });

    it('should return the metadata with custom settings', () => {
      const aiSettings: Omit<AiSettings, 'model'> = {
        randomness: 0.5,
        repetitiveness: 0.5,
        bestOf: 0.5,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
      };

      const adapter = new AiFactoryCompletionAdapter(stubAi, aiSettings);

      expect(adapter.metadata).toEqual({
        model: stubAi.model.externalId,
        temperature: aiSettings.randomness,
        topP: 1,
        contextWindow: 4096,
      });
    });
  });

  describe('complete', () => {
    it('returns the text and raw response', async () => {
      const adapter = new AiFactoryCompletionAdapter(stubAi);
      completion.mockResolvedValueOnce(mockResponse);
      const result = await adapter.complete({ prompt: 'test-prompt' });

      expect(result).toEqual({
        text: mockResponse.text,
        raw: mockResponse,
      });

      expect(completion).toHaveBeenCalledWith('test-prompt', {
        model: stubAi.model.externalId,
        randomness: 0.0,
        repetitiveness: 1,
        bestOf: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
      });
    });

    it('returns text and raw response if input is an array', async () => {
      const adapter = new AiFactoryCompletionAdapter(stubAi);
      completion.mockResolvedValueOnce(mockResponse);
      const result = await adapter.complete({
        prompt: [
          { type: 'text', text: 'test-prompt' },
        ],
      });

      expect(result).toEqual({
        text: mockResponse.text,
        raw: mockResponse,
      });

      expect(completion).toHaveBeenCalledWith('test-prompt', {
        model: stubAi.model.externalId,
        randomness: 0.0,
        repetitiveness: 1,
        bestOf: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
      });
    });

    it('replaces unsupported content type with empty string', async () => {
      const adapter = new AiFactoryCompletionAdapter(stubAi);
      completion.mockResolvedValueOnce(mockResponse);
      const result = await adapter.complete({
        prompt: [
          {
            type: 'image_url',
            text: '',
          },
        ],
      });

      expect(result).toEqual({
        text: mockResponse.text,
        raw: mockResponse,
      });

      expect(completion).toHaveBeenCalledWith('', {
        model: stubAi.model.externalId,
        randomness: 0.0,
        repetitiveness: 1,
        bestOf: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
      });
    });

    it('throws an error if streaming is requested', async () => {
      const adapter = new AiFactoryCompletionAdapter(stubAi);
      await expect(
        adapter.complete({ prompt: 'test-prompt', stream: true })
      ).rejects.toThrow('Streaming not implemented');

      expect(chatCompletion).not.toHaveBeenCalled();
    });
  });

  describe('chat', () => {
    const mockMessages = {
      messages: [
        { content: 'test-prompt', role: 'user' as MessageType },
        { content: 'mocked chat response', role: 'assistant' as MessageType },
      ],
    };

    const mockMessagesArray = {
      messages: [
        {
          content: [{
            type: 'text',
            text: 'test-prompt',
          }],
          role: 'user' as MessageType,
        },
        {
          content: [{
            type: 'text',
            text: 'mocked chat response',
          }],
          role: 'assistant' as MessageType,
        },
      ],
    };

    it('returns the text and raw response', async () => {
      const adapter = new AiFactoryCompletionAdapter(stubAi);
      chatCompletion.mockResolvedValueOnce(mockResponse);
      const result = await adapter.chat(mockMessages);

      expect(result).toEqual({
        message: {
          content: mockResponse.text,
          role: 'assistant',
        },
        raw: mockResponse,
      });

      const expectedMessages: ChatCompletionMessage[] = [
        { role: MessageRole.User, content: 'test-prompt' },
        { role: MessageRole.Assistant, content: 'mocked chat response' },
      ];

      expect(chatCompletion).toHaveBeenCalledWith(
        expectedMessages,
        {
          model: stubAi.model.externalId,
          randomness: 0.0,
          repetitiveness: 1,
          bestOf: 1,
          frequencyPenalty: 0,
          presencePenalty: 0,
        }
      );
    });

    it('returns text and raw response if input is an array', async () => {
      const adapter = new AiFactoryCompletionAdapter(stubAi);
      chatCompletion.mockResolvedValueOnce(mockResponse);
      const result = await adapter.chat(mockMessagesArray);

      expect(result).toEqual({
        message: {
          content: mockResponse.text,
          role: 'assistant',
        },
        raw: mockResponse,
      });

      const expectedMessages: ChatCompletionMessage[] = [
        { role: MessageRole.User, content: 'test-prompt' },
        { role: MessageRole.Assistant, content: 'mocked chat response' },
      ];

      expect(chatCompletion).toHaveBeenCalledWith(
        expectedMessages,
        {
          model: stubAi.model.externalId,
          randomness: 0.0,
          repetitiveness: 1,
          bestOf: 1,
          frequencyPenalty: 0,
          presencePenalty: 0,
        }
      );
    });

    it('replaces unsupported content type with empty string', async () => {
      const adapter = new AiFactoryCompletionAdapter(stubAi);
      chatCompletion.mockResolvedValueOnce(mockResponse);
      
      const messages = {
        messages: [
          { content: [{ type: 'image_url', text: '' }], role: 'user' as MessageType },
          { content: [{ type: 'text', text: 'some response' }], role: 'assistant' as MessageType },
        ],
      };

      await adapter.chat(messages);

      const expectedMessages: ChatCompletionMessage[] = [
        { role: MessageRole.User, content: '' },
        { role: MessageRole.Assistant, content: 'some response' },
      ];

      expect(chatCompletion).toHaveBeenCalledWith(
        expectedMessages,
        {
          model: stubAi.model.externalId,
          randomness: 0.0,
          repetitiveness: 1,
          bestOf: 1,
          frequencyPenalty: 0,
          presencePenalty: 0,
        }
      );
    });

    it('throws an error if streaming is requested', async () => {
      const adapter = new AiFactoryCompletionAdapter(stubAi);
      await expect(
        adapter.chat({ ...mockMessages, stream: true })
      ).rejects.toThrow('Streaming not implemented');

      expect(chatCompletion).not.toHaveBeenCalled();
    });
  });

  describe('castRole', () => {
    it('casts message roles as internal message roles', () => {
      const adapter = new AiFactoryCompletionAdapter(stubAi);
      const testCases: [MessageType, MessageRole][] = [
        ['user', MessageRole.User],
        ['assistant', MessageRole.Assistant],
        ['system', MessageRole.System],
        ['memory', MessageRole.User],
      ];

      testCases.forEach(([input, expected]) => {
        const castRole = (adapter as any).castRole.bind(adapter);
        expect(castRole(input)).toEqual(expected);
      });
    });

    it('throws error for unsupported role', () => {
      const adapter = new AiFactoryCompletionAdapter(stubAi);
      const castRole = (adapter as any).castRole.bind(adapter);
      expect(() => castRole('invalid-role' as any)).toThrow('Unsupported role provided');
    });
  });
});
