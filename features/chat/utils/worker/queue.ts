import { Queue } from 'bullmq';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import { BaseJobData, DEFAULT_QUEUE_OPTIONS } from '@/features/ai-agents/utils/shared/types';
import { Citation } from '@/features/chat/types/message';

export interface ChatJobData extends BaseJobData {
  chatId: string;
  messageId: string;
  modelId: string;
  userMessage: string;
  originalUserMessage: string;
  documentIds: string[];
  knowledgeBaseIds: string[];
  citations: Citation[];
  deepResearchEnabled: boolean;
  useAgenticChat: boolean;
  useGraph?: boolean;
}

let queue: Queue<ChatJobData> | null = null;

export const getChatQueue = (): Queue<ChatJobData> | null => {
  if (queue) {
    return queue;
  }

  try {
    const connection = getRedisClient();
    queue = new Queue<ChatJobData>('chat-jobs', {
      connection,
      defaultJobOptions: { ...DEFAULT_QUEUE_OPTIONS, attempts: 1 },
    });
    return queue;
  } catch (error) {
    logger.info('Redis not available — Chat queue not initialized.');
    return null;
  }
};
