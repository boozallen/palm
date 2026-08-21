import {
  GoogleGenerativeAI,
  GenerateContentResult,
  SchemaType,
  type Content,
  type FunctionDeclarationsTool,
  type FunctionDeclarationSchema,
} from '@google/generative-ai';

import {
  AiRepository,
  AiResponse,
  ChatCompletionMessage,
  completionResponseError,
  emptyCompletionResponseError,
  ToolAwareMessage,
  ToolDefinition,
  ToolAwareResponse,
} from './types';
import { AiSettings } from '@/types';
import logger from '@/server/logger';
import { promptSubmissionErrorMessage } from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import { MessageRole } from '@/features/chat/types/message';
import { AuthenticationError, ModelNotFoundError, RateLimitExceededError } from './errors';
import { AiProviderType, AiProviderLabels } from '@/features/shared/types';

export class GeminiSource implements AiRepository {
  private ai: GoogleGenerativeAI;
  constructor(protected apiKey: string, private providerType: AiProviderType = AiProviderType.Gemini) {
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
          temperature: aiConfig.temperature,
          topP: aiConfig.topP,
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
          temperature: aiConfig.temperature,
          topP: aiConfig.topP,
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

  private aiConfig(config: AiSettings): Pick<AiSettings, 'temperature' | 'topP' | 'model'> {
    return {
      temperature: config?.temperature ?? 0.5,
      topP: config?.topP ?? 1,
      model: config?.model,
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

  async chatCompletionWithTools(
    messages: ToolAwareMessage[],
    tools: ToolDefinition[],
    config: AiSettings,
  ): Promise<ToolAwareResponse> {
    const aiConfig = this.aiConfig(config);

    const systemMsg = messages.find((m) => m.role === 'system');
    const systemInstruction = systemMsg ? (systemMsg as { role: 'system'; content: string }).content : undefined;

    const geminiContents: Content[] = messages
      .filter((m) => m.role !== 'system')
      .map((m): Content => {
        if (m.role === 'tool_call') {
          // Use the preserved raw content (includes thought_signature) if available.
          const raw = m.rawGeminiContent as Content | undefined;
          if (raw) {
            return raw;
          }
          return { role: 'model', parts: [{ functionCall: { name: m.toolName, args: m.toolInput } }] };
        }
        if (m.role === 'tool') {
          return { role: 'user', parts: [{ functionResponse: { name: m.toolCallId, response: { content: m.content } } }] };
        }
        return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: (m as { content: string }).content }] };
      });

    const geminiTools: FunctionDeclarationsTool[] = tools.length > 0
      ? [{
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: {
            type: SchemaType.OBJECT,
            properties: t.inputSchema['properties'] as FunctionDeclarationSchema['properties'],
            required: (t.inputSchema['required'] ?? []) as string[],
          },
        })),
      }]
      : [];

    try {
      const genModel = systemInstruction
        ? this.ai.getGenerativeModel({ model: aiConfig.model, systemInstruction })
        : this.ai.getGenerativeModel({ model: aiConfig.model });

      const result = await genModel.generateContent({
        contents: geminiContents,
        tools: geminiTools.length > 0 ? geminiTools : undefined,
        generationConfig: { temperature: aiConfig.temperature, topP: aiConfig.topP },
      });

      const usageMetadata = result.response.usageMetadata;
      const inputTokensUsed = usageMetadata?.promptTokenCount ?? 0;
      const outputTokensUsed = usageMetadata?.candidatesTokenCount ?? 0;

      const functionCalls = result.response.functionCalls();
      if (functionCalls?.length) {
        const call = functionCalls[0];
        // Preserve the raw candidate content so the thought_signature (if present)
        // can be replayed verbatim on subsequent turns.
        const rawGeminiContent = result.response.candidates?.[0]?.content ?? null;
        return {
          type: 'tool_call',
          toolCallId: call.name,
          toolName: call.name,
          toolInput: call.args as Record<string, unknown>,
          inputTokensUsed,
          outputTokensUsed,
          rawGeminiContent,
        };
      }

      const text = result.response.text();
      if (!text) {
        throw new Error(emptyCompletionResponseError);
      }

      return { type: 'text', text: text.trim(), inputTokensUsed, outputTokensUsed };
    } catch (cause: unknown) {
      const status = (cause as { status?: number }).status;
      const message = (cause as { message?: string }).message ?? String(cause);
      logger.error('GeminiSource.chatCompletionWithTools failed to execute', { status, message });
      switch (status) {
        case 400:
          throw new AuthenticationError(`Gemini 400: ${message}`);
        case 404:
          throw new ModelNotFoundError('Invalid model specified for Gemini');
        case 429:
          throw new RateLimitExceededError('Rate limit exceeded for Gemini');
        default:
          throw new Error(`Gemini error: ${message}`);
      }
    }
  }

  createEmbeddings(_text: string[], _config: AiSettings): Promise<AiResponse> {
    return Promise.reject(
      new Error(
        'The ability to create embeddings with Gemini has not been implemented.'
      )
    );
  }

  toString() {
    return AiProviderLabels[this.providerType];
  }
}
