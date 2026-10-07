import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

import logger from '@/server/logger';
import { AiProviderType, BedrockConfig } from '@/features/shared/types';
import { AiSettings } from '@/types';
import { BedrockSource } from './bedrock';
import {
  ChatCompletionMessage,
  completionResponseError,
  totalTokenUsageResponseError,
} from './types';
import { MessageRole } from '@/features/chat/types/message';
import {
  promptSubmissionErrorMessage,
} from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import { TransientConnectionError } from './errors';
import { NodeHttpHandler } from '@smithy/node-http-handler';

// Minimal stand-in for the TextDecoder jsdom does not supply.
class TextDecoderPolyfill {
  decode(input: Uint8Array): string {
    return Buffer.from(input).toString('utf-8');
  }
}

jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@/server/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('BedrockSource', () => {
  let bedrockSource: BedrockSource;
  let bedrockConfig: BedrockConfig;

  const mockConfig: AiSettings = {
    temperature: 0.7,
    topP: 0.8,
    model: 'testModel',
  };

  const mockResponse = {
    output: {
      message: {
        role: 'assistant',
        content: [{ text: 'response text' }] } },
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    },
  };

  const mockError = new Error('An unknown error occurred, please try again later');

  beforeEach(() => {
    jest.clearAllMocks();

    bedrockConfig = {
      type: AiProviderType.Bedrock,
      accessKeyId: 'testAccessKeyId',
      secretAccessKey: 'testSecretAccessKey',
      sessionToken: 'testSessionToken',
      region: 'testRegion',
    };

    bedrockSource = new BedrockSource(bedrockConfig);
  });

  describe('constructor', () => {
    it('should instantiate BedrockRuntimeClient with correct configuration', () => {
      expect(BedrockRuntimeClient).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: bedrockConfig.accessKeyId,
          secretAccessKey: bedrockConfig.secretAccessKey,
          sessionToken: bedrockConfig.sessionToken,
        },
        region: bedrockConfig.region,
      });
    });

    it('should NOT configure a request timeout handler by default (interactive callers)', () => {
      jest.clearAllMocks();

      new BedrockSource(bedrockConfig);

      expect(BedrockRuntimeClient).toHaveBeenCalledWith(
        expect.not.objectContaining({ requestHandler: expect.anything() })
      );
    });

    it('should configure a request timeout handler when requestTimeoutMs is provided (graph build)', () => {
      jest.clearAllMocks();

      new BedrockSource(bedrockConfig, AiProviderType.Bedrock, { requestTimeoutMs: 120_000 });

      expect(BedrockRuntimeClient).toHaveBeenCalledWith(
        expect.objectContaining({
          requestHandler: expect.any(NodeHttpHandler),
          maxAttempts: 1,
        })
      );
    });
  });

  describe('aiConfig', () => {
    it('should return only supported parameters', () => {
      const config: AiSettings = {
        ...mockConfig,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
      };

      const result = bedrockSource['aiConfig'](config);
      expect(result).toEqual({
        model: mockConfig.model,
      });
    });

    it('should return default values for missing configuration', () => {
      const result = bedrockSource['aiConfig'](mockConfig);
      expect(result).toEqual({
        model: mockConfig.model,
      });
    });
  });

  describe('mapRole', () => {
    it('should map MessageRole.User and MessageRole.System to "user"', () => {
      expect(
        bedrockSource['mapRole'](MessageRole.User)
      ).toBe('user');

      expect(
        bedrockSource['mapRole'](MessageRole.System)
      ).toBe('user');
    });

    it('should map MessageRole.Assistant to "assistant"', () => {
      expect(
        bedrockSource['mapRole'](MessageRole.Assistant)
      ).toBe('assistant');
    });

    it('should throw an error for invalid roles', () => {
      expect(
        () => bedrockSource['mapRole']('invalidRole' as MessageRole)
      ).toThrow('Invalid conversation role provided');

      expect(logger.error).toHaveBeenCalledWith(
        'Invalid conversation role provided: ', 'invalidRole'
      );
    });
  });

  describe('completion', () => {
    const mockPrompt = 'test prompt';

    it('should send the correct command and handle response', async () => {
      (bedrockSource['ai'].send as jest.Mock).mockResolvedValue(mockResponse);

      const result = await bedrockSource.completion(mockPrompt, mockConfig);

      expect(ConverseCommand).toHaveBeenCalledWith({
        modelId: mockConfig.model,
        messages: [
          {
            role: 'user',
            content: [{ text: mockPrompt }],
          },
        ],
      });

      expect(
        bedrockSource['ai'].send
      ).toHaveBeenCalledWith(expect.any(ConverseCommand));

      expect(result).toEqual({
        text: mockResponse.output.message.content[0].text,
        inputTokensUsed: mockResponse.usage.inputTokens,
        outputTokensUsed: mockResponse.usage.outputTokens,
      });
    });

    it('should throw an error if response content is missing', async () => {
      (bedrockSource['ai'].send as jest.Mock).mockResolvedValue({
        usage: mockResponse.usage,
      });

      await expect(
        bedrockSource.completion(mockPrompt, mockConfig)
      ).rejects.toThrow(promptSubmissionErrorMessage);

      expect(logger.error).toHaveBeenCalledWith(
        'BedrockSource.completion failed to execute',
        new Error(completionResponseError)
      );
    });

    it('should throw an error if token usage is missing', async () => {
      (bedrockSource['ai'].send as jest.Mock).mockResolvedValue({
        output: mockResponse.output,
      });

      await expect(
        bedrockSource.completion(mockPrompt, mockConfig)
      ).rejects.toThrow(promptSubmissionErrorMessage);

      expect(logger.error).toHaveBeenCalledWith(
        'BedrockSource.completion failed to execute',
        new Error(totalTokenUsageResponseError)
      );
    });

    it('should log and throw an error if command execution fails', async () => {
      (bedrockSource['ai'].send as jest.Mock).mockRejectedValue(mockError);

      await expect(
        bedrockSource.completion(mockPrompt, mockConfig)
      ).rejects.toThrow(promptSubmissionErrorMessage);

      expect(logger.error).toHaveBeenCalledWith(
        'BedrockSource.completion failed to execute',
        mockError
      );
    });

    it('should throw TransientConnectionError for ECONNRESET in completion', async () => {
      const connectionError = new Error('Connection reset');
      (connectionError as NodeJS.ErrnoException).code = 'ECONNRESET';
      (bedrockSource['ai'].send as jest.Mock).mockRejectedValue(connectionError);

      await expect(
        bedrockSource.completion(mockPrompt, mockConfig)
      ).rejects.toThrow(TransientConnectionError);
    });

    it('should throw TransientConnectionError for ETIMEDOUT in completion', async () => {
      const connectionError = new Error('Connection timed out');
      (connectionError as NodeJS.ErrnoException).code = 'ETIMEDOUT';
      (bedrockSource['ai'].send as jest.Mock).mockRejectedValue(connectionError);

      await expect(
        bedrockSource.completion(mockPrompt, mockConfig)
      ).rejects.toThrow(TransientConnectionError);
    });

    it('should throw TransientConnectionError for a request-timeout (smithy TimeoutError)', async () => {
      // The smithy NodeHttpHandler rejects a timed-out request with name 'TimeoutError'
      // and no `.code` — it must still be classified retryable so retryWithBackoff retries.
      const timeoutError = Object.assign(new Error('Connection timed out after 120000 ms'), {
        name: 'TimeoutError',
      });
      (bedrockSource['ai'].send as jest.Mock).mockRejectedValue(timeoutError);

      await expect(
        bedrockSource.completion(mockPrompt, mockConfig)
      ).rejects.toThrow(TransientConnectionError);

      await expect(
        bedrockSource.completion(mockPrompt, mockConfig)
      ).rejects.toThrow(/Connection error \(TimeoutError\)/);
    });
  });

  describe('chatCompletion', () => {
    const mockChatMessages: ChatCompletionMessage[] = [
      { role: MessageRole.System, content: 'system message' },
      { role: MessageRole.User, content: 'message 1' },
      { role: MessageRole.Assistant, content: 'message 2' },
    ];

    it('should send the correct command and handle response', async () => {
      (bedrockSource['ai'].send as jest.Mock).mockResolvedValue(mockResponse);

      const result = await bedrockSource.chatCompletion(
        mockChatMessages,
        mockConfig
      );

      expect(ConverseCommand).toHaveBeenCalledWith({
        modelId: mockConfig.model,
        messages: mockChatMessages
          .filter((message) => message.role !== MessageRole.System)
          .map((messages) => ({
            role: bedrockSource['mapRole'](messages.role),
            content: [{ text: messages.content }],
          })),
        system: [{ text: mockChatMessages[0].content }],
      });

      expect(bedrockSource['ai'].send).toHaveBeenCalledWith(
        expect.any(ConverseCommand)
      );

      expect(result).toEqual({
        text: mockResponse.output.message.content[0].text,
        inputTokensUsed: mockResponse.usage.inputTokens,
        outputTokensUsed: mockResponse.usage.outputTokens,
      });
    });

    it('should throw an error if response content is missing', async () => {
      (bedrockSource['ai'].send as jest.Mock).mockResolvedValue(
        { usage: mockResponse.usage }
      );

      await expect(
        bedrockSource.chatCompletion(mockChatMessages, mockConfig)
      ).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith(
        'BedrockSource.chatCompletion failed to execute',
        new Error(completionResponseError)
      );
    });

    it('should throw an error if token usage is missing', async () => {
      (bedrockSource['ai'].send as jest.Mock).mockResolvedValue(
        { output: mockResponse.output }
      );

      await expect(
        bedrockSource.chatCompletion(mockChatMessages, mockConfig)
      ).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith(
        'BedrockSource.chatCompletion failed to execute',
        new Error(totalTokenUsageResponseError)
      );
    });

    it('should log and throw an error if command execution fails', async () => {
      (bedrockSource['ai'].send as jest.Mock).mockRejectedValue(mockError);

      await expect(
        bedrockSource.chatCompletion(mockChatMessages, mockConfig)
      ).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith(
        'BedrockSource.chatCompletion failed to execute',
        mockError
      );
    });

    describe('connection error handling', () => {
      it('should throw TransientConnectionError for ECONNRESET', async () => {
        const connectionError = new Error('Connection reset');
        (connectionError as NodeJS.ErrnoException).code = 'ECONNRESET';
        (bedrockSource['ai'].send as jest.Mock).mockRejectedValue(connectionError);

        await expect(
          bedrockSource.chatCompletion(mockChatMessages, mockConfig)
        ).rejects.toThrow(TransientConnectionError);

        await expect(
          bedrockSource.chatCompletion(mockChatMessages, mockConfig)
        ).rejects.toThrow(/Connection error \(ECONNRESET\)/);
      });

      it('should throw TransientConnectionError for ETIMEDOUT', async () => {
        const connectionError = new Error('Connection timed out');
        (connectionError as NodeJS.ErrnoException).code = 'ETIMEDOUT';
        (bedrockSource['ai'].send as jest.Mock).mockRejectedValue(connectionError);

        await expect(
          bedrockSource.chatCompletion(mockChatMessages, mockConfig)
        ).rejects.toThrow(TransientConnectionError);
      });

      it('should throw TransientConnectionError for ERR_HTTP2_STREAM_CANCEL', async () => {
        const connectionError = new Error('HTTP/2 stream cancelled');
        (connectionError as NodeJS.ErrnoException).code = 'ERR_HTTP2_STREAM_CANCEL';
        (bedrockSource['ai'].send as jest.Mock).mockRejectedValue(connectionError);

        await expect(
          bedrockSource.chatCompletion(mockChatMessages, mockConfig)
        ).rejects.toThrow(TransientConnectionError);
      });

      it('should NOT retry non-retryable connection errors like ENOTFOUND', async () => {
        const dnsError = new Error('DNS lookup failed');
        (dnsError as NodeJS.ErrnoException).code = 'ENOTFOUND';
        (bedrockSource['ai'].send as jest.Mock).mockRejectedValue(dnsError);

        // Should throw generic Error, not TransientConnectionError
        await expect(
          bedrockSource.chatCompletion(mockChatMessages, mockConfig)
        ).rejects.toThrow('An unknown error occurred');

        await expect(
          bedrockSource.chatCompletion(mockChatMessages, mockConfig)
        ).rejects.not.toThrow(TransientConnectionError);
      });
    });
  });

  describe('createEmbeddings', () => {
    it('should call the AWS client send method', async () => {
      await expect(
        bedrockSource.createEmbeddings(['test text'], mockConfig)
      ).rejects.toThrow();

      expect(bedrockSource['ai'].send).toHaveBeenCalled();
    });

    it('should throw TransientConnectionError for ECONNRESET in createEmbeddings', async () => {
      const connectionError = new Error('Connection reset');
      (connectionError as NodeJS.ErrnoException).code = 'ECONNRESET';
      (bedrockSource['ai'].send as jest.Mock).mockRejectedValue(connectionError);

      await expect(
        bedrockSource.createEmbeddings(['test text'], mockConfig)
      ).rejects.toThrow(TransientConnectionError);
    });

    it('should throw TransientConnectionError for ETIMEDOUT in createEmbeddings', async () => {
      const connectionError = new Error('Connection timed out');
      (connectionError as NodeJS.ErrnoException).code = 'ETIMEDOUT';
      (bedrockSource['ai'].send as jest.Mock).mockRejectedValue(connectionError);

      await expect(
        bedrockSource.createEmbeddings(['test text'], mockConfig)
      ).rejects.toThrow(TransientConnectionError);
    });

    // jsdom does not provide TextDecoder, which createEmbeddings uses to read
    // the response body. Polyfill it for this block only.
    const originalTextDecoder = global.TextDecoder;

    beforeAll(() => {
      global.TextDecoder = TextDecoderPolyfill as unknown as typeof global.TextDecoder;
    });

    afterAll(() => {
      global.TextDecoder = originalTextDecoder;
    });

    const mockEmbeddingResponse = (inputTextTokenCount?: number) => ({
      body: Buffer.from(JSON.stringify({
        embedding: new Array(1536).fill(0.1),
        ...(inputTextTokenCount === undefined ? {} : { inputTextTokenCount }),
      })),
    } as unknown as { body: Uint8Array });

    it('should report the token count returned by Titan', async () => {
      (bedrockSource['ai'].send as jest.Mock).mockResolvedValue(mockEmbeddingResponse(42));

      const result = await bedrockSource.createEmbeddings(['test text'], mockConfig);

      expect(result.inputTokensUsed).toBe(42);
      expect(result.outputTokensUsed).toBe(0);
      expect(result.embeddings).toHaveLength(1);
    });

    it('should sum the reported token counts across every chunk', async () => {
      (bedrockSource['ai'].send as jest.Mock)
        .mockResolvedValueOnce(mockEmbeddingResponse(10))
        .mockResolvedValueOnce(mockEmbeddingResponse(15));

      const result = await bedrockSource.createEmbeddings(['first', 'second'], mockConfig);

      expect(result.inputTokensUsed).toBe(25);
      expect(result.embeddings).toHaveLength(2);
    });

    it('should prefer the reported token count over the character estimate', async () => {
      // A 40 character input estimates to 10 tokens, so the reported count is
      // the only way this assertion can pass.
      const text = 'a'.repeat(40);
      (bedrockSource['ai'].send as jest.Mock).mockResolvedValue(mockEmbeddingResponse(99));

      const result = await bedrockSource.createEmbeddings([text], mockConfig);

      expect(result.inputTokensUsed).toBe(99);
      expect(result.inputTokensUsed).not.toBe(10);
    });

    it('should estimate tokens when Titan omits the token count', async () => {
      const text = 'a'.repeat(40);
      (bedrockSource['ai'].send as jest.Mock).mockResolvedValue(mockEmbeddingResponse());

      const result = await bedrockSource.createEmbeddings([text], mockConfig);

      expect(result.inputTokensUsed).toBe(10);
    });
  });
});
