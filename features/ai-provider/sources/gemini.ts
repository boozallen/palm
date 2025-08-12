import {
  GoogleGenerativeAI,
  GenerateContentResult,
} from '@google/generative-ai';
import {
  AiRepository,
  AiResponse,
  ChatCompletionMessage,
  completionResponseError,
  emptyCompletionResponseError,
} from './types';
import { AiSettings } from '@/types';
import logger from '@/server/logger';
import { promptSubmissionErrorMessage } from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import { MessageRole } from '@/features/chat/types/message';
import { AuthenticationError, ModelNotFoundError, RateLimitExceededError } from './errors';

export class GeminiSource implements AiRepository {
  private ai: GoogleGenerativeAI;
  constructor(protected apiKey: string) {
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  // For more info about the Gemini API:
  // https://ai.google.dev/gemini-api/docs/get-started/tutorial?lang=node
  async completion(prompt: string, config: AiSettings): Promise<AiResponse> {
    const aiConfig = this.aiConfig(config);

    const model = this.ai.getGenerativeModel({ model: aiConfig.model });

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: aiConfig.randomness,
        },
      });

      if (result.response.text() === undefined) {
        throw new Error(completionResponseError);
      } else if (
        !result.response.text() ||
        result.response.text().length === 0
      ) {
        throw new Error(emptyCompletionResponseError);
      }

      return this.processResult(result);
    } catch (cause) {
      logger.error('GeminiSource.completion failed to execute', cause);
      throw new Error(promptSubmissionErrorMessage);
    }
  }
  async chatCompletion(
    chatMessages: ChatCompletionMessage[],
    config: AiSettings
  ): Promise<AiResponse> {
    const aiConfig = this.aiConfig(config);
    const model = this.ai.getGenerativeModel({ model: aiConfig.model });

    try {
      const geminiMessages = chatMessages.map((msg) => ({
        role: this.mapRole(msg.role),
        parts: [{ text: msg.content }],
      }));

      const result = await model.generateContent({
        contents: geminiMessages,
        generationConfig: {
          temperature: aiConfig.randomness,
        },
      });

      if (result.response.text() === undefined) {
        throw new Error(completionResponseError);
      } else if (
        !result.response.text() ||
        result.response.text().length === 0
      ) {
        throw new Error(emptyCompletionResponseError);
      }

      return this.processResult(result);
    } catch (cause: any) {
      logger.error('GeminiSource.chatCompletion failed to execute', cause);
      const status: number = cause.status;

      switch (status) {
        case 400:
          throw new AuthenticationError('Invalid API key for Gemini');
        case 404:
          throw new ModelNotFoundError('Invalid model specified for Gemini');
        case 429:
          throw new RateLimitExceededError('Rate limit exceeded for Gemini');
        default:
          throw new Error('An unknown error occurred, please try again later');
      }
    }
  }
  // Gemini API only accepts two roles: 'user' and 'model', this maps the roles to the appropriate values
  private mapRole(role: MessageRole): 'user' | 'model' {
    switch (role) {
      case MessageRole.Assistant:
      case MessageRole.System:
        return 'model';
      default:
        return 'user';
    }
  }

  private aiConfig(config: AiSettings): AiSettings {
    return {
      randomness: config?.randomness ?? 0.5,
      repetitiveness: config?.repetitiveness ?? 1,
      model: config?.model,
      bestOf: config?.bestOf ?? 1,
    };
  }
  private processResult(result: GenerateContentResult): AiResponse {
    if (!result.response.text()) {
      throw new Error(emptyCompletionResponseError);
    }
    const usageMetadata = result.response?.usageMetadata;

    return {
      text: result.response.text().trim(),
      inputTokensUsed: usageMetadata ? usageMetadata.promptTokenCount : 0,
      outputTokensUsed: usageMetadata ? usageMetadata.candidatesTokenCount : 0,
    };
  }

  createEmbeddings(_text: string[], _config: AiSettings): Promise<AiResponse> {
    return Promise.reject(
      new Error(
        'The ability to create embeddings with Gemini has not been implemented.'
      )
    );
  }
}
