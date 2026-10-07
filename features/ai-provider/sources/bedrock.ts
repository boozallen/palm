import {
  BedrockRuntimeClient,
  ConversationRole,
  ConverseCommand,
  ConverseCommandInput,
  ConverseStreamCommand,
  ConverseStreamCommandInput,
  Message,
  SystemContentBlock,
  InvokeModelCommand,
  Tool,
  ToolInputSchema,
  ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import type { DocumentType } from '@smithy/types';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import logger from '@/server/logger';
import {
  AiRepository,
  AiResponse,
  ChatCompletionMessage,
  StreamEvent,
  ToolDefinition,
  ToolAwareMessage,
  ToolAwareResponse,
  completionResponseError,
  totalTokenUsageResponseError,
} from './types';
import { AiSettings } from '@/types';
import { BedrockConfig } from '@/features/shared/types';
import { MessageRole } from '@/features/chat/types/message';
import {
  promptSubmissionErrorMessage,
} from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import { AuthenticationError, AuthorizationError, ModelNotFoundError, RateLimitExceededError, TransientConnectionError } from './errors';
import { AiProviderType, AiProviderLabels } from '@/features/shared/types';

/**
 * Connection error codes that should trigger retry logic.
 * These are transient network errors that may succeed on retry.
 */
const RETRYABLE_CONNECTION_ERROR_CODES = new Set([
  'ECONNRESET',           // Connection reset by peer
  'ETIMEDOUT',            // Connection timed out
  'ERR_HTTP2_STREAM_CANCEL', // HTTP/2 stream cancelled
  'ECONNABORTED',         // Connection aborted
  'EPIPE',                // Broken pipe
  'EAI_AGAIN',            // DNS lookup timed out (temporary)
]);

const THINKING_UNSUPPORTED_MODELS = [
  'claude-sonnet-4-5',
  'claude-haiku-4',
  'claude-3-5-',
  'claude-3-haiku',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-2',
  'claude-instant',
];

function modelSupportsThinking(modelId: string): boolean {
  return THINKING_UNSUPPORTED_MODELS.every((m) => !modelId.includes(m));
}

// Prompt caching is NOT supported on Claude 3 originals (3-haiku, 3-opus, 3-sonnet),
// Claude 2, and Claude Instant. All Claude 3.5+, 3.7, and 4.x models support it.
function modelSupportsCaching(modelId: string): boolean {
  // Strip cross-region inference prefixes like "us." or "eu."
  const id = modelId.replace(/^[a-z]{2,3}\./, '');
  const UNSUPPORTED = [
    'anthropic.claude-3-haiku-2',   // claude-3-haiku (not 3-5-haiku)
    'anthropic.claude-3-opus',
    'anthropic.claude-3-sonnet',
    'anthropic.claude-2',
    'anthropic.claude-instant',
  ];
  return id.startsWith('anthropic.claude-') && !UNSUPPORTED.some((prefix) => id.startsWith(prefix));
}

/**
 * Check if an error is a retryable connection error.
 * Connection errors have error.code property (not error.name).
 */
function isRetryableConnectionError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return typeof code === 'string' && RETRYABLE_CONNECTION_ERROR_CODES.has(code);
}

type SchemaNode = Record<string, unknown> | unknown[] | unknown;

// Port of LiteLLM's unpack_defs — expands all $ref entries inline, handles circular refs
function unpackDefs(schema: Record<string, unknown>, defs: Record<string, unknown>): void {
  const rootDefs: Record<string, unknown> = {
    ...defs,
    ...(schema['$defs'] as Record<string, unknown> ?? {}),
    ...(schema['definitions'] as Record<string, unknown> ?? {}),
  };

  type QueueItem = [SchemaNode, Record<string, unknown> | unknown[] | null, string | number | null, Record<string, unknown>, Set<string>];
  const queue: QueueItem[] = [[schema, null, null, rootDefs, new Set()]];

  while (queue.length > 0) {
    const [node, parent, key, activeDefs, refChain] = queue.shift()!;

    if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
      const dictNode = node as Record<string, unknown>;

      if ('$ref' in dictNode && typeof dictNode['$ref'] === 'string') {
        const refName = dictNode['$ref'].split('/').pop()!;
        if (refChain.has(refName)) {
          continue;
        }
        const target = activeDefs[refName];
        if (target === undefined || target === null) {
          continue;
        }
        const childDefs: Record<string, unknown> = {
          ...activeDefs,
          ...((target as Record<string, unknown>)['$defs'] as Record<string, unknown> ?? {}),
          ...((target as Record<string, unknown>)['definitions'] as Record<string, unknown> ?? {}),
        };
        const resolved: Record<string, unknown> = JSON.parse(JSON.stringify(target));
        if (parent !== null && key !== null) {
          (parent as Record<string, unknown>)[key as string] = resolved;
        } else {
          Object.keys(schema).forEach((k) => delete schema[k]);
          Object.assign(schema, resolved);
        }
        const newChain = new Set(refChain);
        newChain.add(refName);
        queue.push([resolved, parent, key, childDefs, newChain]);
        continue;
      }

      const currentDefs: Record<string, unknown> = {
        ...activeDefs,
        ...(dictNode['$defs'] as Record<string, unknown> ?? {}),
        ...(dictNode['definitions'] as Record<string, unknown> ?? {}),
      };
      for (const [k, v] of Object.entries(dictNode)) {
        queue.push([v, dictNode, k, currentDefs, refChain]);
      }
    } else if (Array.isArray(node)) {
      node.forEach((item, idx) => {
        queue.push([item, node, idx, activeDefs, refChain]);
      });
    }
  }
}

const VALID_JSON_SCHEMA_ROOT_TYPES = new Set(['array', 'boolean', 'integer', 'null', 'number', 'object', 'string']);

function cleanSchemaStrings(node: unknown): unknown {
  if (typeof node === 'string') {
    return node.replace(/\s+/g, ' ').trim();
  }
  if (Array.isArray(node)) {
    return node.map(cleanSchemaStrings);
  }
  if (node !== null && typeof node === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      result[k] = cleanSchemaStrings(v);
    }
    return result;
  }
  return node;
}

// Port of LiteLLM's _bedrock_tools_pt schema building — whitelist type/properties/required only
function bedrockToolSchema(inputSchema: Record<string, unknown>): Record<string, unknown> {
  const parameters = JSON.parse(JSON.stringify(inputSchema)) as Record<string, unknown>;
  const defs = (parameters['$defs'] ?? {}) as Record<string, unknown>;
  delete parameters['$defs'];
  delete parameters['definitions'];
  unpackDefs(parameters, defs);
  // normalize type: "custom" → "object" (Claude Code Agent SDK uses "custom")
  if (parameters['type'] === 'custom' || !VALID_JSON_SCHEMA_ROOT_TYPES.has(parameters['type'] as string)) {
    parameters['type'] = 'object';
  }
  const result: Record<string, unknown> = { type: parameters['type'] };
  if (parameters['properties'] !== undefined) {
    const props = parameters['properties'] as Record<string, Record<string, unknown>>;
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      const { description: _desc, ...rest } = v;
      cleaned[k] = rest;
    }
    result['properties'] = cleaned;
  }
  if (parameters['required'] !== undefined) {
    result['required'] = parameters['required'];
  }
  return result;
}

/**
 * The smithy NodeHttpHandler rejects a timed-out request with an Error whose
 * `name` is 'TimeoutError' (and no `.code`). Treat it as retryable so a hung
 * request fails fast and retryWithBackoff re-runs it, instead of blocking
 * indefinitely.
 */
function isRetryableTimeoutError(error: unknown): boolean {
  return (error as { name?: string })?.name === 'TimeoutError';
}

// Time to establish the TCP/TLS connection before giving up.
const BEDROCK_CONNECTION_TIMEOUT_MS = 5000;

// For more info about the Amazon Bedrock API:
// https://docs.aws.amazon.com/bedrock/latest/APIReference/welcome.html
export class BedrockSource implements AiRepository {
  private readonly ai: BedrockRuntimeClient;

  constructor(
    protected bedrockConfig: BedrockConfig,
    private providerType: AiProviderType = AiProviderType.Bedrock,
    opts?: { requestTimeoutMs?: number },
  ) {
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

    // A per-request timeout is opt-in (graph-build extraction/resolution only) so a
    // hung Bedrock call fails fast and retryWithBackoff can recover, instead of
    // freezing the build. Interactive callers omit it and keep the SDK defaults.
    // When the timeout is on, also pin maxAttempts to 1 so retryWithBackoff is the
    // single retry authority — otherwise the SDK's own 3x retry stacks on top of it
    // and multiplies the time-to-give-up on a genuinely-dead endpoint.
    const requestHandler = opts?.requestTimeoutMs
      ? new NodeHttpHandler({
          connectionTimeout: BEDROCK_CONNECTION_TIMEOUT_MS,
          requestTimeout: opts.requestTimeoutMs,
        })
      : undefined;

    this.ai = new BedrockRuntimeClient({
      credentials,
      region: bedrockConfig.region,
      ...(requestHandler ? { requestHandler, maxAttempts: 1 } : {}),
    });
  }

  private aiConfig(config: AiSettings): Pick<AiSettings, 'model'> {
    return {
      model: config?.model ?? '',
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

      // Check for retryable connection/timeout errors first
      if (isRetryableConnectionError(cause) || isRetryableTimeoutError(cause)) {
        const code = (cause as NodeJS.ErrnoException).code ?? 'TimeoutError';
        throw new TransientConnectionError(`Connection error (${code})`, code);
      }

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
      ...(config.maxTokens ? { inferenceConfig: { maxTokens: config.maxTokens } } : {}),
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

      // Check for retryable connection/timeout errors first
      if (isRetryableConnectionError(cause) || isRetryableTimeoutError(cause)) {
        const code = (cause as NodeJS.ErrnoException).code ?? 'TimeoutError';
        throw new TransientConnectionError(`Connection error (${code})`, code);
      }

      // Then check AWS-specific errors (by error.name)
      const name: string = (cause as Error).name;

      switch (name) {
        case 'UnrecognizedClientException':
          throw new AuthenticationError('Invalid AWS credentials for Bedrock');
        case 'AccessDeniedException':
          throw new AuthorizationError('Missing access permissions for Bedrock');
        case 'ValidationException':
        case 'ResourceNotFoundException':
          throw new ModelNotFoundError('Invalid model specified for Bedrock');
        case 'ThrottlingException':
        case 'ModelNotReadyException':
        case 'ServiceUnavailableException':
          throw new RateLimitExceededError('Rate limit exceeded for Bedrock');
        default:
          throw new Error('An unknown error occurred, please try again later');
      }
    }
  }

  async createEmbeddings(input: string[], config: AiSettings): Promise<AiResponse> {

    try {
      // Taken from the caller rather than hardcoded: the model embeddings run on
      // is whichever one an admin designated embeddings-only on the provider, and
      // AIFactory.buildEmbeddingSource resolves it and passes its externalId in.
      const modelId = config.model;

      if (!modelId) {
        throw new Error('No embedding model was specified for Bedrock');
      }

      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      // Amazon Titan doesn't support batch processing - process embeddings individually
      // Process in batches to avoid overwhelming the API and hitting rate limits
      const BATCH_SIZE = 25;
      logger.info(`Processing ${input.length} embeddings in batches of ${BATCH_SIZE} for model: ${modelId}`);

      const embeddingsResults = [];

      // Process in batches
      for (let i = 0; i < input.length; i += BATCH_SIZE) {
        const batch = input.slice(i, i + BATCH_SIZE);
        logger.info(`Processing embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(input.length / BATCH_SIZE)} (${batch.length} items)`);

        const embeddingPromises = batch.map(async (text) => {
          const body = JSON.stringify({
            inputText: text,
          });

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

          if (embedding.length !== 1536) {
            throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected 1536. Model ${modelId} may not be compatible with current schema.`);
          }

          // Titan reports the billed token count on the response; only fall
          // back to an estimate when the field is missing.
          totalInputTokens += typeof responseBody.inputTextTokenCount === 'number'
            ? responseBody.inputTextTokenCount
            : Math.ceil(text.length / 4);

          return {
            embedding: embedding,
          };
        });

        const batchResults = await Promise.all(embeddingPromises);
        embeddingsResults.push(...batchResults);
      }

      return {
        text: '',
        inputTokensUsed: totalInputTokens,
        outputTokensUsed: totalOutputTokens,
        embeddings: embeddingsResults,
      };
    } catch (cause: unknown) {
      logger.error('BedrockSource.createEmbeddings failed to execute', cause);

      // Check for retryable connection/timeout errors first
      if (isRetryableConnectionError(cause) || isRetryableTimeoutError(cause)) {
        const code = (cause as NodeJS.ErrnoException).code ?? 'TimeoutError';
        throw new TransientConnectionError(`Connection error (${code})`, code);
      }

      // Then check AWS-specific errors (by error.name)
      const name: string = (cause as Error).name;

      switch (name) {
        case 'UnrecognizedClientException':
          throw new AuthenticationError('Invalid AWS credentials for Bedrock');
        case 'AccessDeniedException':
          throw new AuthorizationError('Missing access permissions for Bedrock');
        case 'ValidationException':
        case 'ResourceNotFoundException':
          throw new ModelNotFoundError('Invalid model specified for Bedrock');
        case 'ThrottlingException':
        case 'ModelNotReadyException':
        case 'ServiceUnavailableException':
          throw new RateLimitExceededError('Rate limit exceeded for Bedrock');
        default:
          throw new Error('An unknown error occurred while creating embeddings, please try again later');
      }
    }
  }

  async chatCompletionWithTools(
    messages: ToolAwareMessage[],
    tools: ToolDefinition[],
    config: AiSettings,
    forceToolUse = false,
  ): Promise<ToolAwareResponse> {
    const aiConfig = this.aiConfig(config);

    const systemMessage = messages.find((m) => m.role === 'system');
    const cachingSupported = modelSupportsCaching(aiConfig.model);
    const system: SystemContentBlock[] | undefined = systemMessage
      ? [
          { text: (systemMessage as { role: 'system'; content: string }).content },
          ...(cachingSupported ? [{ cachePoint: { type: 'default' } } as SystemContentBlock] : []),
        ]
      : undefined;

    const bedrockMessages: Message[] = messages
      .filter((m) => m.role !== 'system')
      .map((m): Message => {
        if (m.role === 'tool_call') {
          return {
            role: 'assistant',
            content: [{
              toolUse: {
                toolUseId: m.toolCallId,
                name: m.toolName,
                input: m.toolInput as DocumentType,
              },
            }],
          };
        }
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [{
              toolResult: {
                toolUseId: m.toolCallId,
                content: [{ text: m.content }],
              },
            }],
          };
        }
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: [{ text: m.content }],
        };
      });

    try {
      const toolDefs: Tool[] = tools.map((t) => {
        const rawDesc = (t.description || t.name).replace(/\s+/g, ' ').trim();
        const description = rawDesc.length > 1000 ? rawDesc.slice(0, 997) + '...' : rawDesc;
        return {
          toolSpec: {
            name: t.name,
            description,
            inputSchema: { json: bedrockToolSchema(t.inputSchema) } as ToolInputSchema,
          },
        };
      });
      const bedrockTools: Tool[] = toolDefs.length > 0 && cachingSupported
        ? [...toolDefs, { cachePoint: { type: 'default' } }]
        : toolDefs;

      const input: ConverseCommandInput = {
        modelId: aiConfig.model,
        messages: bedrockMessages,
        system,
        ...(config.maxTokens ? { inferenceConfig: { maxTokens: config.maxTokens } } : {}),
        ...(bedrockTools.length > 0 ? {
          toolConfig: {
            tools: bedrockTools,
            ...(forceToolUse ? { toolChoice: { any: {} } } : {}),
          },
        } : {}),
      };

      const command = new ConverseCommand(input);
      const response = await this.ai.send(command);
      const content = response.output?.message?.content;
      const usage = response.usage;

      if (usage) {
        const u = usage as unknown as Record<string, unknown>;
        logger.debug('[BEDROCK] token usage', {
          model: aiConfig.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadInputTokens: u['cacheReadInputTokens'],
          cacheWriteInputTokens: u['cacheWriteInputTokens'],
        });
      }

      if (!usage?.inputTokens) {
        throw new Error(completionResponseError);
      }

      const toolUseBlocks = (content ?? []).filter((block: ContentBlock) => 'toolUse' in block);
      if (toolUseBlocks.length === 1 && 'toolUse' in toolUseBlocks[0] && toolUseBlocks[0].toolUse) {
        return {
          type: 'tool_call',
          toolCallId: toolUseBlocks[0].toolUse.toolUseId ?? '',
          toolName: toolUseBlocks[0].toolUse.name ?? '',
          toolInput: (toolUseBlocks[0].toolUse.input ?? {}) as Record<string, unknown>,
          inputTokensUsed: usage.inputTokens,
          outputTokensUsed: usage.outputTokens ?? 0,
        };
      }
      if (toolUseBlocks.length > 1) {
        const textBlock = content?.find((block: ContentBlock) => 'text' in block);
        const text = (textBlock && 'text' in textBlock && textBlock.text) ? textBlock.text.trim() : undefined;
        return {
          type: 'tool_calls',
          toolCalls: toolUseBlocks
            .filter((block) => 'toolUse' in block && !!block.toolUse)
            .map((block) => {
              const tu = (block as { toolUse: { toolUseId?: string; name?: string; input?: unknown } }).toolUse;
              return {
                toolCallId: tu.toolUseId ?? '',
                toolName: tu.name ?? '',
                toolInput: (tu.input ?? {}) as Record<string, unknown>,
              };
            }),
          text,
          inputTokensUsed: usage.inputTokens,
          outputTokensUsed: usage.outputTokens ?? 0,
        };
      }

      const textBlock = content?.find((block: ContentBlock) => 'text' in block);
      const text = (textBlock && 'text' in textBlock && textBlock.text) ? textBlock.text.trim() : '';

      return {
        type: 'text',
        text,
        inputTokensUsed: usage.inputTokens,
        outputTokensUsed: usage.outputTokens ?? 0,
      };
    } catch (cause: unknown) {
      logger.error('BedrockSource.chatCompletionWithTools failed to execute', cause);

      if (isRetryableConnectionError(cause)) {
        const code = (cause as NodeJS.ErrnoException).code;
        throw new TransientConnectionError(`Connection error (${code})`, code);
      }

      const name: string = (cause as Error).name;
      switch (name) {
        case 'UnrecognizedClientException':
          throw new AuthenticationError('Invalid AWS credentials for Bedrock');
        case 'AccessDeniedException':
          throw new AuthorizationError('Missing access permissions for Bedrock');
        case 'ValidationException':
        case 'ResourceNotFoundException':
          throw new ModelNotFoundError('Invalid model specified for Bedrock');
        case 'ThrottlingException':
        case 'ModelNotReadyException':
        case 'ServiceUnavailableException':
          throw new RateLimitExceededError('Rate limit exceeded for Bedrock');
        case 'SerializationException':
          logger.error('[BEDROCK] SerializationException', { toolNames: tools.map((t) => t.name), cause: (cause as Error).message });
          throw new Error(`Bedrock SerializationException: ${(cause as Error).message}`);
        default:
          throw new Error(`Bedrock unknown error (${name}): ${(cause as Error).message}`);
      }
    }
  }

  async *streamChatCompletionWithTools(
    messages: ToolAwareMessage[],
    tools: ToolDefinition[],
    config: AiSettings,
    forceToolUse = false,
  ): AsyncGenerator<StreamEvent> {
    const aiConfig = this.aiConfig(config);

    const systemMessage = messages.find((m) => m.role === 'system');
    const cachingSupported = modelSupportsCaching(aiConfig.model);
    const system: SystemContentBlock[] | undefined = systemMessage
      ? [
          { text: (systemMessage as { role: 'system'; content: string }).content },
          ...(cachingSupported ? [{ cachePoint: { type: 'default' } } as SystemContentBlock] : []),
        ]
      : undefined;

    const bedrockMessages: Message[] = messages
      .filter((m) => m.role !== 'system')
      .map((m): Message => {
        if (m.role === 'tool_call') {
          return {
            role: 'assistant',
            content: [{
              toolUse: {
                toolUseId: m.toolCallId,
                name: m.toolName,
                input: m.toolInput as DocumentType,
              },
            }],
          };
        }
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [{
              toolResult: {
                toolUseId: m.toolCallId,
                content: [{ text: m.content }],
              },
            }],
          };
        }
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: [{ text: m.content }],
        };
      });

    const toolDefs: Tool[] = tools.map((t) => {
      const rawDesc = (t.description || t.name).replace(/\s+/g, ' ').trim();
      const description = rawDesc.length > 1000 ? rawDesc.slice(0, 997) + '...' : rawDesc;
      return {
        toolSpec: {
          name: t.name,
          description,
          inputSchema: { json: bedrockToolSchema(t.inputSchema) } as ToolInputSchema,
        },
      };
    });
    const bedrockTools: Tool[] = toolDefs.length > 0 && cachingSupported
      ? [...toolDefs, { cachePoint: { type: 'default' } }]
      : toolDefs;

    const thinkingEnabled = modelSupportsThinking(aiConfig.model);
    const input: ConverseStreamCommandInput = {
      modelId: aiConfig.model,
      messages: bedrockMessages,
      system,
      inferenceConfig: { maxTokens: config.maxTokens || 16000 },
      ...(thinkingEnabled ? {
        additionalModelRequestFields: {
          thinking: { type: 'adaptive', display: 'summarized' },
        },
      } : {}),
      ...(bedrockTools.length > 0 ? {
        toolConfig: {
          tools: bedrockTools,
          ...(forceToolUse ? { toolChoice: { any: {} } } : {}),
        },
      } : {}),
    };

    const command = new ConverseStreamCommand(input);
    const response = await this.ai.send(command);

    let textAccum = '';
    let inputTokens = 0;
    let outputTokens = 0;

    // Accumulate multiple tool calls — each contentBlockStart with toolUse
    // begins a new entry; subsequent deltas append to the current (last) entry.
    const toolAccum: { id: string; name: string; inputChunks: string[] }[] = [];

    if (!response.stream) {
      throw new Error('Bedrock ConverseStream did not return a stream');
    }

    for await (const event of response.stream) {
      if ('contentBlockStart' in event && event.contentBlockStart) {
        const start = event.contentBlockStart.start;
        if (start && 'toolUse' in start && start.toolUse) {
          toolAccum.push({
            id: start.toolUse.toolUseId ?? '',
            name: start.toolUse.name ?? '',
            inputChunks: [],
          });
          yield { type: 'tool_start', toolUseId: start.toolUse.toolUseId ?? '', toolName: start.toolUse.name ?? '' };
        }
      } else if ('contentBlockDelta' in event && event.contentBlockDelta) {
        const delta = event.contentBlockDelta.delta;
        if (delta) {
          if ('text' in delta && delta.text) {
            textAccum += delta.text;
            yield { type: 'text_delta', text: delta.text };
          } else if ('toolUse' in delta && delta.toolUse) {
            const current = toolAccum[toolAccum.length - 1];
            if (current) {
              current.inputChunks.push(delta.toolUse.input ?? '');
            }
            yield { type: 'tool_delta', input: delta.toolUse.input ?? '' };
          } else if ('reasoningContent' in delta && delta.reasoningContent) {
            const rc = delta.reasoningContent as unknown as Record<string, unknown>;
            if ('text' in rc && typeof rc.text === 'string') {
              yield { type: 'thinking_delta', text: rc.text };
            }
          }
        }
      } else if ('metadata' in event && event.metadata) {
        const usage = event.metadata.usage;
        if (usage) {
          inputTokens = usage.inputTokens ?? 0;
          outputTokens = usage.outputTokens ?? 0;
        }
      }
    }

    if (toolAccum.length > 0) {
      const parsedCalls = toolAccum.map((tc) => {
        let toolInput: Record<string, unknown> = {};
        try {
          toolInput = JSON.parse(tc.inputChunks.join('')) as Record<string, unknown>;
        } catch {
          toolInput = { raw: tc.inputChunks.join('') };
        }
        return { toolCallId: tc.id, toolName: tc.name, toolInput };
      });

      if (parsedCalls.length === 1) {
        yield {
          type: 'done',
          response: {
            type: 'tool_call',
            ...parsedCalls[0],
            inputTokensUsed: inputTokens,
            outputTokensUsed: outputTokens,
          },
        };
      } else {
        yield {
          type: 'done',
          response: {
            type: 'tool_calls',
            toolCalls: parsedCalls,
            text: textAccum.trim() || undefined,
            inputTokensUsed: inputTokens,
            outputTokensUsed: outputTokens,
          },
        };
      }
    } else {
      yield {
        type: 'done',
        response: {
          type: 'text',
          text: textAccum.trim(),
          inputTokensUsed: inputTokens,
          outputTokensUsed: outputTokens,
        },
      };
    }
  }

  toString() {
    return AiProviderLabels[this.providerType];
  }
}
