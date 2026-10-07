import { Queue } from 'bullmq';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import { BaseJobData, DEFAULT_QUEUE_OPTIONS } from '@/features/ai-agents/utils/shared/types';

export interface AgentChatJobData extends BaseJobData {
  chatId: string;
  messageId: string;
  userMessage: string;
  sessionId: string;
  agentProviderId: string;
}

let queue: Queue<AgentChatJobData> | null = null;

export const getAgentChatQueue = (): Queue<AgentChatJobData> | null => {
  if (queue) {
    return queue;
  }

  try {
    const connection = getRedisClient();
    queue = new Queue<AgentChatJobData>('agent-chat-jobs', {
      connection,
      defaultJobOptions: DEFAULT_QUEUE_OPTIONS,
    });
    return queue;
  } catch (error) {
    logger.info('Redis not available — Agent chat queue not initialized.');
    return null;
  }
};
