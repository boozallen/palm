
import { AiSettings } from '@/types';
import type { PrismaClient, Prisma } from '@prisma/client';
import {
  AiRepository,
  AiResponse,
  ChatCompletionMessage,
  StreamEvent,
  ToolAwareMessage,
  ToolDefinition,
  ToolAwareResponse,
} from './types';
import logger from '@/server/logger';

type InputJsonValue = Prisma.InputJsonValue;

export class AuditedSource implements AiRepository {
  constructor(
    protected source: AiRepository,
    protected _userId: string,
    protected prisma: PrismaClient,
    protected ctx: unknown = {}
  ) { }

  get userId() {
    return this._userId;
  }

  completion(prompt: string, config: AiSettings) {
    return this._run('completion', prompt, config ?? {}, () => this.source.completion(prompt, config));
  }

  chatCompletion(chatMessages: ChatCompletionMessage[], config: AiSettings) {
    let chatMessagesString = JSON.stringify(chatMessages);
    return this._run('completion', chatMessagesString, config ?? {}, () => this.source.chatCompletion(chatMessages, config));
  }

  createEmbeddings(text: string[], config: AiSettings) {
    let embeddingInputLogString = text.join(', ');
    return this._run('createEmbeddings', embeddingInputLogString, config ?? {}, () => this.source.createEmbeddings(text, config));
  }

  async _run(method: string, prompt: string, config: InputJsonValue, fn: () => Promise<AiResponse>): Promise<AiResponse> {
    let result: AiResponse | null = null;
    let error: string | null = null;

    result = await fn();

    try {
      await this.prisma.logEntry.create({
        data: {
          method, prompt, config, result: result?.text, error,
          source: String(this.source),
          userId: this.userId,
          context: this.ctx as InputJsonValue,
        },
      });
    } catch (err: unknown) {
      // The completion already succeeded and was billed; losing the audit row
      // is worth logging, but not worth failing the caller's request over.
      logger.error(`Failed to save audit log for user: UserId: ${this.userId}`, err);
    }

    return result;
  }

  async chatCompletionWithTools(messages: ToolAwareMessage[], tools: ToolDefinition[], config: AiSettings, forceToolUse?: boolean): Promise<ToolAwareResponse> {
    if (!this.source.chatCompletionWithTools) {
      throw new Error('Tool-use completion is not supported by the underlying source');
    }
    const result = await this.source.chatCompletionWithTools(messages, tools, config, forceToolUse);
    try {
      await this.prisma.logEntry.create({
        data: {
          method: 'chatCompletionWithTools',
          prompt: JSON.stringify(messages),
          config: config as InputJsonValue,
          result: result.type,
          error: null,
          source: String(this.source),
          userId: this.userId,
          context: this.ctx as InputJsonValue,
        },
      });
    } catch (err: unknown) {
      // See _run: the response is already paid for, so return it.
      logger.error(`Failed to save audit log for user: UserId: ${this.userId}`, err);
    }
    return result;
  }

  async *streamChatCompletionWithTools(messages: ToolAwareMessage[], tools: ToolDefinition[], config: AiSettings, forceToolUse?: boolean): AsyncGenerator<StreamEvent> {
    if (!this.source.streamChatCompletionWithTools) {
      throw new Error('Streaming tool-use completion is not supported by the underlying source');
    }
    for await (const event of this.source.streamChatCompletionWithTools(messages, tools, config, forceToolUse)) {
      yield event;
    }
  }

  async deepResearch(input: string, instructions: string, maxToolCalls?: number, cancellationJobId?: string): Promise<string> {
    if (!this.source.deepResearch) {
      throw new Error('Deep research is not supported by the underlying source');
    }
    return this.source.deepResearch(input, instructions, maxToolCalls, cancellationJobId);
  }
}
