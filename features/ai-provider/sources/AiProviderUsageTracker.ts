import {
  AiRepository,
  ChatCompletionMessage,
  AiResponse,
  StreamEvent,
  ToolAwareMessage,
  ToolDefinition,
  ToolAwareResponse,
} from './types';
import { AiSettings } from '@/types';
import logger from '@/server/logger';
import createAiProviderUsageRecord from './dal/createAiProviderUsageRecord';

// Optional provenance for a usage row: which chat message or which workflow
// primitive this LLM call belongs to. Both are absent for calls that belong to
// neither surface (embeddings, conversation summaries, knowledge graph builds).
// Those calls are still categorized by the system/agent/knowledgeGraph/embedding
// flags on the usage row itself.
export type UsageAttribution = {
  chatMessageId?: string;
  workflowExecutionId?: string;
  primitiveId?: string;
  // Which document an ingestion embedding was made for. Absent on every other
  // kind of call — only document upload embeds a specific document.
  documentId?: string;
  // Human-readable step within the message/primitive, e.g. 'plan', 'response',
  // or a '+'-joined tool batch. One message can produce many usage rows.
  stepLabel?: string;
};

export class AiProviderUsageTracker<T extends AiRepository> implements AiRepository {
  constructor(
    protected source: T,
    protected _userId: string,
    protected _modelId: string,
    protected _isSystem: boolean,
    protected _agent: boolean = false,
    protected _knowledgeGraph: boolean = false,
    protected _attribution: UsageAttribution = {},
    protected _embedding: boolean = false,
    protected _userGroupId?: string,
  ) {
  }

  get userId() {
    return this._userId;
  }

  get modelId() {
    return this._modelId;
  }

  get isSystem() {
    return this._isSystem;
  }

  completion(prompt: string, config: AiSettings) {
    return this._run(() => this.source.completion(prompt, config));
  }

  chatCompletion(chatMessages: ChatCompletionMessage[], config: AiSettings) {
    return this._run(() => this.source.chatCompletion(chatMessages, config));
  }

  createEmbeddings(text: string[], config: AiSettings) {
    return this._run(() => this.source.createEmbeddings(text, config));
  }

  async _run(fn: () => Promise<AiResponse>): Promise<AiResponse> {
    let result: AiResponse | null = null;

    result = await fn();

    try {
      await createAiProviderUsageRecord({
        userId: this.userId,
        modelId: this.modelId,
        inputTokensUsed: result.inputTokensUsed,
        outputTokensUsed: result.outputTokensUsed,
        system: this.isSystem,
        agent: this._agent,
        knowledgeGraph: this._knowledgeGraph,
        embedding: this._embedding,
        userGroupId: this._userGroupId,
        ...this._attribution,
      });
    } catch (error) {
      // The provider has already billed for this call, so a failed usage write
      // must not discard the response — log the gap and return it anyway.
      logger.error(`Unable to add record to AiProviderUsage table. UserId: ${this.userId}`, error);
    }

    return result;
  }

  async chatCompletionWithTools(messages: ToolAwareMessage[], tools: ToolDefinition[], config: AiSettings, forceToolUse?: boolean): Promise<ToolAwareResponse> {
    if (!this.source.chatCompletionWithTools) {
      throw new Error('Tool-use completion is not supported by the underlying source');
    }
    const result = await this.source.chatCompletionWithTools(messages, tools, config, forceToolUse);
    try {
      await createAiProviderUsageRecord({
        userId: this.userId,
        modelId: this.modelId,
        inputTokensUsed: result.inputTokensUsed,
        outputTokensUsed: result.outputTokensUsed,
        system: this.isSystem,
        agent: this._agent,
        knowledgeGraph: this._knowledgeGraph,
        embedding: this._embedding,
        userGroupId: this._userGroupId,
        ...this._attribution,
      });
    } catch (error) {
      // See _run: billed spend is already incurred, so keep the response.
      logger.error(`Unable to add record to AiProviderUsage table. UserId: ${this.userId}`, error);
    }
    return result;
  }

  async *streamChatCompletionWithTools(messages: ToolAwareMessage[], tools: ToolDefinition[], config: AiSettings, forceToolUse?: boolean): AsyncGenerator<StreamEvent> {
    if (!this.source.streamChatCompletionWithTools) {
      throw new Error('Streaming tool-use completion is not supported by the underlying source');
    }
    for await (const event of this.source.streamChatCompletionWithTools(messages, tools, config, forceToolUse)) {
      if (event.type === 'done') {
        try {
          await createAiProviderUsageRecord({
            userId: this.userId,
            modelId: this.modelId,
            inputTokensUsed: event.response.inputTokensUsed,
            outputTokensUsed: event.response.outputTokensUsed,
            system: this.isSystem,
            agent: this._agent,
            knowledgeGraph: this._knowledgeGraph,
            embedding: this._embedding,
            userGroupId: this._userGroupId,
            ...this._attribution,
          });
        } catch (error) {
          logger.error(`Unable to add record to AiProviderUsage table. UserId: ${this.userId}`, error);
        }
      }
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
