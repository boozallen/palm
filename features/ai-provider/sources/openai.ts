import OpenAI, { APIError } from 'openai';
import { AiSettings } from '@/types';
import logger from '@/server/logger';
import { promptSubmissionErrorMessage } from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import {
  AiRepository,
  AiResponse,
  ChatCompletionMessage,
  completionResponseError,
  emptyCompletionResponseError,
  totalTokenUsageResponseError,
} from './types';
import { AuthenticationError, ModelNotFoundError, RateLimitExceededError } from './errors';

export class OpenAiSource implements AiRepository {
  private readonly ai: OpenAI;
  constructor(protected apiKey: string) {
    this.ai = new OpenAI({ apiKey });
  }

  async completion(prompt: string, config: AiSettings): Promise<AiResponse> {
    const aiConfig = this.aiConfig(config);

    try {
      const { choices, usage } = await this.ai.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: aiConfig.randomness,
        frequency_penalty: aiConfig.frequencyPenalty as number,
        presence_penalty: aiConfig.presencePenalty as number,
      });

      if (choices.length === 0) {
        throw new Error(totalTokenUsageResponseError);
      } else if (usage === undefined) {
        throw new Error(completionResponseError);
      }

      const { content } = choices[0].message;
      if (!content) {
        throw new Error(emptyCompletionResponseError);
      }

      const inputTokensUsed = usage.prompt_tokens;
      const outputTokensUsed = usage.total_tokens - inputTokensUsed;

      return { text: content, inputTokensUsed, outputTokensUsed };
    } catch (cause) {
      logger.error('OpenAiSource.completion failed to execute', cause);
      throw new Error(promptSubmissionErrorMessage);
    }
  }

  async chatCompletion(
    chatMessages: ChatCompletionMessage[],
    config: AiSettings,
  ): Promise<AiResponse> {
    const aiConfig = this.aiConfig(config);

    try {
      const { choices, usage } = await this.ai.chat.completions.create({
        model: aiConfig.model,
        messages: chatMessages,
        temperature: aiConfig.randomness,
        frequency_penalty: aiConfig.frequencyPenalty as number,
        presence_penalty: aiConfig.presencePenalty as number,
      });

      if (choices.length === 0) {
        throw new Error(completionResponseError);
      } else if (usage === undefined) {
        throw new Error(totalTokenUsageResponseError);
      }

      const { content } = choices[0].message;
      if (!content) {
        throw new Error(emptyCompletionResponseError);
      }

      const inputTokensUsed = usage.prompt_tokens;
      const outputTokensUsed = usage.total_tokens - inputTokensUsed;

      return { text: content, inputTokensUsed, outputTokensUsed };
    } catch (cause: unknown) {
      logger.error('OpenAiSource.chatCompletion failed to execute', cause);
      if (typeof APIError === 'function' && cause instanceof APIError) {
        /* https://platform.openai.com/docs/guides/error-codes */
        switch (cause.status) {
          case 401:
          case 403:
            throw new AuthenticationError('Invalid API key provided for OpenAI');
          case 404:
            throw new ModelNotFoundError('Invalid model specified for OpenAI');
          case 429:
            throw new RateLimitExceededError('Rate limit exceeded for OpenAI');
          default:
            throw new Error('An unknown error occurred, please try again later');
        }
      } else {
        throw new Error('An unknown error occurred, please try again later');
      }

    }
  }

  async createEmbeddings(
    text: string[],
    __config: AiSettings,
  ): Promise<AiResponse> {
    try {
      // The default return size of a vector embeding is 1536. In order to achieve a smaller vector size, the openAI client will need to be upgraded to version 4.
      const { data, usage } = await this.ai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      const inputTokensUsed = usage.prompt_tokens;
      const outputTokensUsed = usage.total_tokens - inputTokensUsed;

      return { embeddings: data, inputTokensUsed, outputTokensUsed, text: '' };
    } catch (cause) {
      logger.error('OpenAiSource.createEmbeddings failed to execute', cause);
      throw new Error(promptSubmissionErrorMessage);
    }
  }

  private aiConfig(config: AiSettings): AiSettings {
    return {
      randomness: config?.randomness ?? 0.5,
      repetitiveness: config?.repetitiveness ?? 1,
      model: config?.model ?? '',
      bestOf: config?.bestOf ?? 1,
      frequencyPenalty: config?.frequencyPenalty ?? 0,
      presencePenalty: config?.presencePenalty ?? 0,
    };
  }
  toString() {
    return 'Open AI Source';
  }
}
