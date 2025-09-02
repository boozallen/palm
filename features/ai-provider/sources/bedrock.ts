import {
  BedrockRuntimeClient,
  ConversationRole,
  ConverseCommand,
  ConverseCommandInput,
  Message,
  SystemContentBlock,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

import logger from '@/server/logger';
import {
  AiRepository,
  AiResponse,
  ChatCompletionMessage,
  completionResponseError,
  totalTokenUsageResponseError,
} from './types';
import { AiSettings } from '@/types';
import { BedrockConfig } from '@/features/shared/types';
import { MessageRole } from '@/features/chat/types/message';
import {
  promptSubmissionErrorMessage,
} from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import { AuthenticationError, AuthorizationError, ModelNotFoundError, RateLimitExceededError } from './errors';
import { BEDROCK_TITAN_EMBEDDING_MODEL } from '@/features/shared/constants/bedrock';

// For more info about the Amazon Bedrock API:
// https://docs.aws.amazon.com/bedrock/latest/APIReference/welcome.html
export class BedrockSource implements AiRepository {
  private readonly ai: BedrockRuntimeClient;

  constructor(protected bedrockConfig: BedrockConfig) {
    if (!bedrockConfig.accessKeyId || !bedrockConfig.secretAccessKey) {
      throw new Error('Invalid or missing parameters for AI provider');
    }

    const credentials: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    } = {
      accessKeyId: bedrockConfig.accessKeyId,
      secretAccessKey: bedrockConfig.secretAccessKey,
    };

    // Only include sessionToken if it has a value
    if (bedrockConfig.sessionToken) {
      credentials.sessionToken = bedrockConfig.sessionToken;
    }

    this.ai = new BedrockRuntimeClient({
      credentials,
      region: bedrockConfig.region,
    });
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

  private mapRole(role: MessageRole): ConversationRole {
    switch (role) {
      case MessageRole.User:
      case MessageRole.System:
        return 'user';
      case MessageRole.Assistant:
        return 'assistant';
      default:
        logger.error('Invalid conversation role provided: ', role);
        throw new Error('Invalid conversation role provided');
    }
  }

  async completion(prompt: string, config: AiSettings): Promise<AiResponse> {
    const aiConfig = this.aiConfig(config);

    const input: ConverseCommandInput = {
      modelId: aiConfig.model,
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        temperature: aiConfig.randomness,
      },
    };

    const command = new ConverseCommand(input);

    try {
      const response = await this.ai.send(command);

      const content = response.output?.message?.content;
      const usage = response.usage;

      if (!content?.[0]?.text) {
        throw new Error(completionResponseError);
      } else if (!usage?.inputTokens || !usage?.outputTokens) {
        throw new Error(totalTokenUsageResponseError);
      }

      return {
        text: content[0].text.trim(),
        inputTokensUsed: usage.inputTokens,
        outputTokensUsed: usage.outputTokens,
      };
    } catch (cause) {
      logger.error('BedrockSource.completion failed to execute', cause);
      throw new Error(promptSubmissionErrorMessage);
    }
  }

  async chatCompletion(chatMessages: ChatCompletionMessage[], config: AiSettings): Promise<AiResponse> {
    const aiConfig = this.aiConfig(config);

    const systemMessage = chatMessages.find((message) => message.role === MessageRole.System);

    let system: SystemContentBlock[] | undefined;

    if (systemMessage) {
      system = [{
        text: systemMessage.content,
      }];
    }

    const messages: Message[] = chatMessages
      .filter((message) => message.role !== MessageRole.System)
      .map((message) => ({
        role: this.mapRole(message.role),
        content: [{
          text: message.content,
        }],
      }));

    const input: ConverseCommandInput = {
      modelId: aiConfig.model,
      messages,
      system,
      inferenceConfig: {
        temperature: aiConfig.randomness,
      },
    };

    const command = new ConverseCommand(input);
    try {
      const response = await this.ai.send(command);

      const content = response.output?.message?.content;
      const usage = response.usage;

      if (!content?.[0]?.text) {
        throw new Error(completionResponseError);
      } else if (!usage?.inputTokens || !usage?.outputTokens) {
        throw new Error(totalTokenUsageResponseError);
      }

      return {
        text: content[0].text.trim(),
        inputTokensUsed: usage.inputTokens,
        outputTokensUsed: usage.outputTokens,
      };
    } catch (cause: unknown) {
      logger.error('BedrockSource.chatCompletion failed to execute', cause);
      const name: string = (cause as Error).name;

      switch (name) {
        case 'UnrecognizedClientException':
          throw new AuthenticationError('Invalid AWS credentials for Bedrock');
        case 'AccessDeniedException':
          throw new AuthorizationError('Missing access permissions for Bedrock');
        case 'ValidationException':
        case 'ResourceNotFoundException':
          throw new ModelNotFoundError('Invalid model specified for Bedrock');
        case 'ModelNotReadyException':
          throw new RateLimitExceededError('Rate limit exceeded for Bedrock');
        default:
          throw new Error('An unknown error occurred, please try again later');
      }
    }
  }

  async createEmbeddings(input: string[], _config: AiSettings): Promise<AiResponse> {

    try {
      const embeddings = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      for (const text of input) {
        const body = JSON.stringify({
          inputText: text,
        });

        const modelId = BEDROCK_TITAN_EMBEDDING_MODEL;

        const command = new InvokeModelCommand({
          modelId: modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: body,
        });

        const response = await this.ai.send(command);

        if (!response.body) {
          throw new Error('No response body received from the embedding model');
        }

        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        if (!responseBody.embedding) {
          throw new Error('No embedding found in response');
        }

        const embedding = responseBody.embedding;
        logger.debug(`Embedding dimensions: ${embedding.length} for model: ${modelId}`);

        if (embedding.length !== 1536) {
          throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected 1536. Model ${modelId} may not be compatible with current schema.`);
        }

        embeddings.push({
          embedding: embedding,
        });

        // Titan doesn't provide token usage, so we estimate
        totalInputTokens += Math.ceil(text.length / 4);
      }

      return {
        text: '',
        inputTokensUsed: totalInputTokens,
        outputTokensUsed: totalOutputTokens,
        embeddings,
      };
    } catch (cause: unknown) {
      logger.error('BedrockSource.createEmbeddings failed to execute', cause);
      const name: string = (cause as Error).name;

      switch (name) {
        case 'UnrecognizedClientException':
          throw new AuthenticationError('Invalid AWS credentials for Bedrock');
        case 'AccessDeniedException':
          throw new AuthorizationError('Missing access permissions for Bedrock');
        case 'ValidationException':
        case 'ResourceNotFoundException':
          throw new ModelNotFoundError('Invalid embedding model specified for Bedrock');
        case 'ModelNotReadyException':
          throw new RateLimitExceededError('Rate limit exceeded for Bedrock');
        default:
          throw new Error('An unknown error occurred while creating embeddings, please try again later');
      }
    }
  }
}
