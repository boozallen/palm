import {
  AiRepository,
  AiResponse,
  completionResponseError,
  totalTokenUsageResponseError,
  emptyCompletionResponseError,
  ChatCompletionMessage,
} from './types';
import '@anthropic-ai/sdk/shims/node';
import Anthropic from '@anthropic-ai/sdk';
import { AiSettings } from '@/types';
import logger from '@/server/logger';
import { promptSubmissionErrorMessage } from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import { MessageRole } from '@/features/chat/types/message';
import { AuthenticationError, ModelNotFoundError, RateLimitExceededError } from './errors';

export class AnthropicSource implements AiRepository {
  private api: Anthropic;
  constructor(protected apiKey: string) {
    this.api = new Anthropic({
      apiKey: apiKey,
    });
  }

  maxTokensPerRequest = 4096;

  // For more info about the Anthropic API:
  // https://docs.anthropic.com/claude/reference/getting-started-with-the-api

  async completion(prompt: string, config: AiSettings): Promise<AiResponse> {
    try {
      const response = await this.api.messages.create({
        model: config.model,
        max_tokens: this.maxTokensPerRequest,
        messages: [
          { 'role': 'user', 'content': prompt },
        ],
      });

      if (response.content.length === 0 || response.content[0].text === undefined) {
        throw new Error(completionResponseError);
      } else if (response.content[0].text.length === 0) {
        throw new Error(emptyCompletionResponseError);
      } else if (response.usage === undefined) {
        throw new Error(totalTokenUsageResponseError);
      }

      return {
        text: response.content[0].text,
        inputTokensUsed: response.usage.input_tokens,
        outputTokensUsed: response.usage.output_tokens,
      };
    } catch (cause) {
      logger.error('AnthropicSource.completion failed to execute', cause);
      throw new Error(promptSubmissionErrorMessage);
    }
  }

  async chatCompletion(messages: ChatCompletionMessage[], config: AiSettings): Promise<AiResponse> {
    let systemMessage;
    const chatMessages: { role: MessageRole.User | MessageRole.Assistant, content: string }[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemMessage = message.content;
      } else {
        chatMessages.push({
          content: message.content,
          role: message.role,
        });
      }
    }

    try {
      const response = await this.api.messages.create({
        model: config.model,
        max_tokens: this.maxTokensPerRequest,
        system: systemMessage,
        messages: chatMessages,
      });

      if (response.content.length === 0 || response.content[0].text === undefined) {
        throw new Error(completionResponseError);
      } else if (response.content[0].text.length === 0) {
        throw new Error(emptyCompletionResponseError);
      } else if (response.usage === undefined) {
        throw new Error(totalTokenUsageResponseError);
      }

      return {
        text: response.content[0].text,
        inputTokensUsed: response.usage.input_tokens,
        outputTokensUsed: response.usage.output_tokens,
      };
    } catch (cause: any) {
      logger.error('AnthropicSource.chatCompletion failed to execute', cause);
      const status = cause.status;

      switch (status) {
        case 401:
          throw new AuthenticationError('Invalid API key for Anthropic');
        case 404:
          throw new ModelNotFoundError('Invalid model specified for Anthropic');
        case 429:
          throw new RateLimitExceededError('Rate limit exceeded for Anthropic');
        default:
          throw new Error('Unknown error occurred, please try again later');
      }
    }
  }

  createEmbeddings(_text: string[], _config: AiSettings): Promise<AiResponse> {
    return Promise.reject(new Error('The ability to create embeddings with Anthropic has not been implemented.'));
  }
}
