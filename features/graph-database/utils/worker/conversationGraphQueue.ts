import { Queue } from 'bullmq';

import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import { logger } from '@/server/logger';
import { getRedisClient } from '@/server/storage/redisConnection';

export type ConversationGraphSyncJobData = {
  chatId: string;
  messageIds: string[];
};

type ConversationGraphSyncEnqueueOptions = {
  propagateErrors: boolean;
};

let conversationGraphQueue: Queue<ConversationGraphSyncJobData> | null = null;

export const getConversationGraphQueue = (): Queue<ConversationGraphSyncJobData> | null => {
  if (conversationGraphQueue) {
    return conversationGraphQueue;
  }

  try {
    const connection = getRedisClient();
    conversationGraphQueue = new Queue<ConversationGraphSyncJobData>('conversation-graph', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 15000,
        },
      },
    });
    logger.info('Conversation graph queue initialized successfully');
    return conversationGraphQueue;
  } catch (error) {
    logger.error('Could not initialize conversation graph queue', { error });
    return null;
  }
};

const enqueueConversationGraphSyncJob = async (
  data: ConversationGraphSyncJobData,
  options: ConversationGraphSyncEnqueueOptions,
): Promise<void> => {
  if (!(await isMemoryEnabled())) {
    return;
  }
  if (data.messageIds.length === 0) {
    logger.debug('Conversation graph sync not enqueued for empty message list', {
      chatId: data.chatId,
    });
    return;
  }

  try {
    const queue = getConversationGraphQueue();
    if (!queue) {
      if (options.propagateErrors) {
        throw new Error('Conversation graph queue is unavailable');
      }
      return;
    }
    await queue.add('sync', data);
  } catch (error) {
    logger.error('Error enqueueing conversation graph sync', {
      chatId: data.chatId,
      error,
    });
    if (options.propagateErrors) {
      throw new Error('Error enqueueing conversation graph sync');
    }
  }
};

export const enqueueConversationGraphSync = async (
  data: ConversationGraphSyncJobData,
): Promise<void> => enqueueConversationGraphSyncJob(data, { propagateErrors: false });

export const enqueueConversationGraphBackfill = async (
  data: ConversationGraphSyncJobData,
): Promise<void> => enqueueConversationGraphSyncJob(data, { propagateErrors: true });
