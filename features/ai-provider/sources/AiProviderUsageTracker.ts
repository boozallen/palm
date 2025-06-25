import { AiRepository, ChatCompletionMessage, AiResponse } from './types';
import { AiSettings } from '@/types';
import logger from '@/server/logger';
import createAiProviderUsageRecord from './dal/createAiProviderUsageRecord';

export class AiProviderUsageTracker<T extends AiRepository> implements AiRepository {
  constructor(
    protected source: T,
    protected _userId: string,
    protected _modelId: string,
    protected _isSystem: boolean,
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
      const aiProviderUsageRecordInput = {
        userId: this.userId,
        modelId: this.modelId,
        inputTokensUsed: result.inputTokensUsed,
        outputTokensUsed: result.outputTokensUsed,
        system: this.isSystem,
      };

      await createAiProviderUsageRecord(aiProviderUsageRecordInput);

      return result;
    } catch (error) {
      logger.error(`Unable to add record to AiProviderUsage table. UserId: ${this.userId}`, error);
      throw new Error('Unable to track AI provider usage');
    }
  }
}
