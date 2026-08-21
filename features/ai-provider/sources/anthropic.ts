import {
  AiRepository,
  AiResponse,
  completionResponseError,
  totalTokenUsageResponseError,
  emptyCompletionResponseError,
  ChatCompletionMessage,
  ToolAwareMessage,
  ToolDefinition,
  ToolAwareResponse,
} from './types';
import '@anthropic-ai/sdk/shims/node';
import Anthropic from '@anthropic-ai/sdk';
import { AiSettings } from '@/types';
import logger from '@/server/logger';
import { promptSubmissionErrorMessage } from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import { MessageRole } from '@/features/chat/types/message';
import { AuthenticationError, ModelNotFoundError, RateLimitExceededError } from './errors';
import { AiProviderType, AiProviderLabels } from '@/features/shared/types';

export class AnthropicSource implements AiRepository {
  private api: Anthropic;
  constructor(protected apiKey: string, private providerType: AiProviderType = AiProviderType.Anthropic) {
    this.api = new Anthropic({
      apiKey: apiKey,
    });
  }

  maxTokensPerRequest = 4096;

  private aiConfig(config: AiSettings): Pick<AiSettings, 'temperature' | 'topP' | 'model'> {
    return {
      temperature: config?.temperature ?? 0.5,
      topP: config?.topP ?? 1,
      model: config?.model ?? '',
    };
  }

  // For more info about the Anthropic API:
  // https://docs.anthropic.com/claude/reference/getting-started-with-the-api

  async completion(prompt: string, config: AiSettings): Promise<AiResponse> {
    const aiConfig = this.aiConfig(config);

    // Anthropic does not allow both temperature and top_p simultaneously.
    // If topP has not been modified from its default (1), use temperature; otherwise use top_p.
    const samplingParams = aiConfig.topP === 1
      ? { temperature: aiConfig.temperature }
      : { top_p: aiConfig.topP };

    try {
      const response = await this.api.messages.create({
        model: aiConfig.model,
        max_tokens: this.maxTokensPerRequest,
        ...samplingParams,
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

    const aiConfig = this.aiConfig(config);

    // Anthropic does not allow both temperature and top_p simultaneously.
    // If topP has not been modified from its default (1), use temperature; otherwise use top_p.
    const samplingParams = aiConfig.topP === 1
      ? { temperature: aiConfig.temperature }
      : { top_p: aiConfig.topP };

    try {
      const response = await this.api.messages.create({
        model: aiConfig.model,
        max_tokens: this.maxTokensPerRequest,
        ...samplingParams,
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

  async chatCompletionWithTools(
    messages: ToolAwareMessage[],
    tools: ToolDefinition[],
    config: AiSettings,
  ): Promise<ToolAwareResponse> {
    const aiConfig = this.aiConfig(config);

    const systemMessage = messages.find((m) => m.role === 'system');
    const system = systemMessage ? (systemMessage as { role: 'system'; content: string }).content : undefined;

    type LooseContentBlock = { type: string; [key: string]: unknown };
    type LooseMessage = { role: 'user' | 'assistant'; content: string | LooseContentBlock[] };

    const anthropicMessages: LooseMessage[] = messages
      .filter((m) => m.role !== 'system')
      .map((m): LooseMessage => {
        if (m.role === 'tool_call') {
          return {
            role: 'assistant',
            content: [{ type: 'tool_use', id: m.toolCallId, name: m.toolName, input: m.toolInput }],
          };
        }
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
          };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      });

    const anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    const samplingParams = aiConfig.topP === 1
      ? { temperature: aiConfig.temperature }
      : { top_p: aiConfig.topP };

    try {
      const response = await (this.api.messages.create as unknown as (params: unknown) => Promise<{
        content: LooseContentBlock[];
        usage: { input_tokens: number; output_tokens: number };
      }>)({
        model: aiConfig.model,
        max_tokens: this.maxTokensPerRequest,
        ...samplingParams,
        system,
        messages: anthropicMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      });

      const inputTokensUsed = response.usage.input_tokens;
      const outputTokensUsed = response.usage.output_tokens;

      const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
      if (toolUseBlock) {
        return {
          type: 'tool_call',
          toolCallId: toolUseBlock['id'] as string,
          toolName: toolUseBlock['name'] as string,
          toolInput: toolUseBlock['input'] as Record<string, unknown>,
          inputTokensUsed,
          outputTokensUsed,
        };
      }

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock?.['text']) {
        throw new Error(emptyCompletionResponseError);
      }

      return { type: 'text', text: textBlock['text'] as string, inputTokensUsed, outputTokensUsed };
    } catch (cause: unknown) {
      logger.error('AnthropicSource.chatCompletionWithTools failed to execute', cause);
      const status = (cause as { status?: number }).status;
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

  toString() {
    return AiProviderLabels[this.providerType];
  }
}
