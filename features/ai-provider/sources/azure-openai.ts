import {
  AzureKeyCredential,
  OpenAIClient,
  type ChatRequestMessageUnion,
  type ChatCompletionsFunctionToolDefinition,
  type ChatRequestAssistantMessage,
  type ChatRequestToolMessage,
} from '@azure/openai';
import {
  AiRepository,
  AiResponse,
  completionResponseError,
  totalTokenUsageResponseError,
  emptyCompletionResponseError,
  embeddingsResponseError,
  EmbeddingResponse,
  ChatCompletionMessage,
  ToolAwareMessage,
  ToolDefinition,
  ToolAwareResponse,
} from './types';
import { AiSettings } from '@/types';
import { promptSubmissionErrorMessage } from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import logger from '@/server/logger';
import { AiProviderType, AiProviderLabels } from '@/features/shared/types';

export class AzureOpenAISource implements AiRepository {
  private deployment: string;
  private client: OpenAIClient;

  constructor(apiKey: string, apiEndpoint: string, deployment: string, private providerType: AiProviderType = AiProviderType.AzureOpenAi) {
    if (!apiKey || !apiEndpoint) {
      throw new Error('Invalid or missing parameters for AI provider');
    }

    this.deployment = deployment;

    this.client = new OpenAIClient(apiEndpoint, new AzureKeyCredential(apiKey));
  }

  async chat(prompt: string, config: AiSettings): Promise<AiResponse> {
    return this.completion(prompt, config);
  }

  async completion(prompt: string, config: AiSettings): Promise<AiResponse> {
    try {
      const response = await this.client.getChatCompletions(
        config.model ?? this.deployment,
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          temperature: config.temperature ?? 0.0,
          topP: config.topP,
          presencePenalty: config.presencePenalty ?? 0,
          frequencyPenalty: config.frequencyPenalty ?? 0,
        }
      );

      if (response === undefined) {
        throw new Error(completionResponseError);
      }

      if (response.choices.length === 0 || response.choices[0].message === undefined) {
        throw new Error(completionResponseError);
      } else if (response.usage === undefined) {
        throw new Error(totalTokenUsageResponseError);
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error(emptyCompletionResponseError);
      }

      return {
        text: content?.trim(),
        inputTokensUsed: response.usage.promptTokens,
        outputTokensUsed: response.usage.completionTokens,
      };
    } catch (cause) {
      logger.error('AzureOpenAiSource.completion failed to execute', cause);
      throw new Error(promptSubmissionErrorMessage);
    }
  }

  async chatCompletion(chatMessages: ChatCompletionMessage[], config: AiSettings): Promise<AiResponse> {
    try {
      const response = await this.client.getChatCompletions(
        this.deployment,
        chatMessages,
        {
          temperature: config.temperature ?? 0.0,
          topP: config.topP,
          presencePenalty: config.presencePenalty ?? 0,
          frequencyPenalty: config.frequencyPenalty ?? 0,
        }
      );

      if (response === undefined) {
        throw new Error(completionResponseError);
      }

      if (response.choices.length === 0 || response.choices[0].message === undefined) {
        throw new Error(completionResponseError);
      } else if (response.usage === undefined) {
        throw new Error(totalTokenUsageResponseError);
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error(emptyCompletionResponseError);
      }

      return {
        text: content?.trim(),
        inputTokensUsed: response.usage.promptTokens,
        outputTokensUsed: response.usage.completionTokens,
      };
    } catch (cause) {
      logger.error('AzureOpenAiSource.chatCompletion failed to execute', cause);
      throw new Error(promptSubmissionErrorMessage);
    }
  }

  async createEmbeddings(text: string[], _config: AiSettings): Promise<AiResponse> {
    try {
      const response = await this.client.getEmbeddings(
        this.deployment,
        text,
        {
          model: 'text-embedding-3-small',
        }
      );

      if (response === undefined || response.data === undefined || response.data.length === 0) {
        throw new Error(embeddingsResponseError);
      } else if (response.usage === undefined) {
        throw new Error(totalTokenUsageResponseError);
      }

      // Pull the embeddings out of the AI response and create a simpler structure that works for openai and azure-openai
      const embeddingResponse: EmbeddingResponse[] = response.data.map(emd => ({ embedding: emd.embedding }));

      // Calculate completion tokens since they are not included in a getEmbeddings response
      const outputTokensUsed = response.usage.totalTokens - response.usage.promptTokens;

      return {
        embeddings: embeddingResponse,
        inputTokensUsed: response.usage.promptTokens,
        outputTokensUsed: outputTokensUsed,
        text: '',
      };
    } catch (cause) {
      logger.error('AzureOpenAiSource.createEmbeddings failed to execute', cause);
      throw new Error(promptSubmissionErrorMessage);
    }
  }

  async chatCompletionWithTools(
    messages: ToolAwareMessage[],
    tools: ToolDefinition[],
    config: AiSettings,
  ): Promise<ToolAwareResponse> {
    const azureMessages: ChatRequestMessageUnion[] = messages.map((m) => {
      if (m.role === 'tool_call') {
        const assistantMsg: ChatRequestAssistantMessage = {
          role: 'assistant',
          content: null,
          toolCalls: [{
            type: 'function',
            id: m.toolCallId,
            function: { name: m.toolName, arguments: JSON.stringify(m.toolInput) },
          }],
        };
        return assistantMsg;
      }
      if (m.role === 'tool') {
        const toolMsg: ChatRequestToolMessage = {
          role: 'tool',
          toolCallId: m.toolCallId,
          content: m.content,
        };
        return toolMsg;
      }
      return { role: m.role as 'user' | 'assistant' | 'system', content: m.content };
    });

    const azureTools: ChatCompletionsFunctionToolDefinition[] = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    try {
      const response = await this.client.getChatCompletions(this.deployment, azureMessages, {
        temperature: config.temperature ?? 0.0,
        topP: config.topP,
        tools: azureTools.length > 0 ? azureTools : undefined,
      });

      if (!response?.choices?.length || !response.usage) {
        throw new Error(completionResponseError);
      }

      const inputTokensUsed = response.usage.promptTokens;
      const outputTokensUsed = response.usage.completionTokens;
      const choice = response.choices[0];

      if (choice.message?.toolCalls?.length) {
        const call = choice.message.toolCalls[0];
        if (call.type === 'function') {
          const fnCall = call as { type: 'function'; id: string; function: { name: string; arguments: string } };
          return {
            type: 'tool_call',
            toolCallId: fnCall.id,
            toolName: fnCall.function.name,
            toolInput: JSON.parse(fnCall.function.arguments) as Record<string, unknown>,
            inputTokensUsed,
            outputTokensUsed,
          };
        }
      }

      const content = choice.message?.content;
      if (!content) {
        throw new Error(emptyCompletionResponseError);
      }

      return { type: 'text', text: content.trim(), inputTokensUsed, outputTokensUsed };
    } catch (cause) {
      logger.error('AzureOpenAISource.chatCompletionWithTools failed to execute', cause);
      throw new Error(promptSubmissionErrorMessage);
    }
  }

  toString() {
    return AiProviderLabels[this.providerType];
  }
}
