
import { AiSettings } from '@/types';
import type { PrismaClient, Prisma } from '@prisma/client';
import { AiRepository, AiResponse, ChatCompletionMessage } from './types';
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

      return result;
    } catch (err: unknown) {
      logger.error(`Failed to save audit log for user: UserId: ${this.userId}`, err);
      throw new Error('Failed to save audit log');
    }
  }
}
