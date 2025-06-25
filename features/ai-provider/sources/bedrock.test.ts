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

jest.mock('@aws-sdk/client-bedrock-runtime');

describe('BedrockSource', () => {
  let bedrockSource: BedrockSource;
  let bedrockConfig: BedrockConfig;

  const mockConfig: AiSettings = {
    randomness: 0.7,
    repetitiveness: 0.8,
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
  });

  describe('aiConfig', () => {
    it('should return the correct AI configuration', () => {
      const config: AiSettings = {
        ...mockConfig,
        bestOf: 2,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
      };

      const result = bedrockSource['aiConfig'](config);
      expect(result).toEqual(config);
    });

    it('should return default values for missing configuration', () => {
      const result = bedrockSource['aiConfig'](mockConfig);
      expect(result).toEqual({
        ...mockConfig,
        bestOf: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
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
        inferenceConfig: { temperature: mockConfig.randomness },
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
        inferenceConfig: { temperature: mockConfig.randomness },
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
  });

  describe('createEmbeddings', () => {
    it('should throw an error', async () => {
      await expect(
        bedrockSource.createEmbeddings([], mockConfig)
      ).rejects.toThrow('Method not implemented.');
    });
  });
});
