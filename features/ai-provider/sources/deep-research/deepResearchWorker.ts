import { Worker } from 'bullmq';

import logger from '@/server/logger';
import { DeepResearchJobData } from './deepResearchQueue';
import { getRedisClient } from '@/server/storage/redisConnection';
import { AIFactory } from '@/features/ai-provider/factory';
import { extractArtifactsFromMessage } from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import { extractFollowUpQuestionsFromMessage } from '@/features/chat/utils/followUpQuestionsHelpers';
import updateMessage from '@/features/chat/dal/updateMessage';
import { enqueueConversationGraphSync } from '@/features/graph-database/utils/worker/conversationGraphQueue';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import db from '@/server/db';

let worker: Worker | null = null;
let shutdownInProgress = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  logger.debug(`${signal} received, shutting down DeepResearch worker...`);

  try {
    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down DeepResearch worker after timeout');
        throw new Error('Force DeepResearch worker shutdown due to timeout');
      }, 15000);
      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.debug('DeepResearch worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down DeepResearch worker:', error);
    throw new Error('Error shutting down DeepResearch worker');
  }
};

const deepResearch = async (jobData: DeepResearchJobData): Promise<{ content: string }> => {
  const { userId, modelId, input, instructions, maxToolCalls, jobId, messageId } = jobData;

  try {
    const redis = getRedisClient();
    const cancellationKey = `deep-research:cancel:${jobId}`;
    const isCancelled = await redis.get(cancellationKey);
    
    if (isCancelled) {
      if (messageId) {
        await db.chatMessage.update({
          where: { id: messageId },
          data: { deepResearchStatus: 'cancelled' },
        });
      }
      return { content: '' };
    }
    
    const aiFactory = new AIFactory({ userId });
    const ai = await aiFactory.buildUserSource(modelId);
    
    if (!ai.source.deepResearch) {
      throw new Error(`Model ${modelId} does not support deep research execution`);
    }
    
    const isCancelledBeforeResearch = await redis.get(cancellationKey);
    if (isCancelledBeforeResearch) {
      if (messageId) {
        await db.chatMessage.update({
          where: { id: messageId },
          data: { deepResearchStatus: 'cancelled' },
        });
      }
      return { content: '' };
    }
    
    const content = await ai.source.deepResearch(input, instructions || '', maxToolCalls, jobId);
    const isCancelledAfterResearch = await redis.get(cancellationKey);
    if (isCancelledAfterResearch) {
      if (messageId) {
        await db.chatMessage.update({
          where: { id: messageId },
          data: { deepResearchStatus: 'cancelled' },
        });
      }
      return { content: '' };
    }
    
    const { artifacts, cleanedText } = extractArtifactsFromMessage(content);
    const { followUpQuestions, cleanedText: finalCleanedText } = 
      extractFollowUpQuestionsFromMessage(cleanedText);

    if (messageId) {
      await updateMessage({
        messageId: messageId,
        content: finalCleanedText,
        artifacts: artifacts,
        followUpQuestions: followUpQuestions,
        deepResearchStatus: 'completed',
      });

      if (await isMemoryEnabled()) {
        const message = await db.chatMessage.findUnique({
          where: { id: messageId },
          select: { chatId: true },
        });
        if (message) {
          void enqueueConversationGraphSync({
            chatId: message.chatId,
            messageIds: [messageId],
          });
        }
      }
    }

    return { content: finalCleanedText };
    
  } catch (error) {
    if (messageId) {
      try {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isCancellationError = errorMessage.includes('Job was cancelled');
        
        if (isCancellationError) {
          await db.chatMessage.update({
            where: { id: messageId },
            data: { deepResearchStatus: 'cancelled' },
          });
          return { content: '' };
        } else {
          await db.chatMessage.update({
            where: { id: messageId },
            data: { deepResearchStatus: 'failed' },
          });
        }
      } catch (updateError) {
        logger.error(`Failed to update message status for messageId: ${messageId}`, updateError);
      }
    }
    
    throw error;
  }
};

export const startDeepResearchWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.debug(
      'Redis not available — skipping deep research queue/worker startup.'
    );
    return;
  }

  if (worker?.isRunning()) {
    logger.debug('DeepResearch worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<DeepResearchJobData>(
    'deep-research-jobs',
    async (job) => {
      const { jobId } = job.data;

      try {
        
        const result = await deepResearch(job.data);
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Deep research job ${jobId} failed:`, {
          message: errorMessage,
          error: error,
        });

        throw error;
      }
    },
    {
      connection,
      lockDuration: 600000, 
      concurrency: 2,
      limiter: {
        max: 2,
        duration: 5000,
      },
      stalledInterval: 180000, 
      maxStalledCount: 2,
    }
  );

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
  logger.debug('DeepResearch worker started successfully');
};
