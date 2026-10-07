/**
 * BullMQ queue for workflow execution
 */

import { Queue } from 'bullmq';
import logger from '@/server/logger';
import { getRedisClient } from '@/server/storage/redisConnection';

export interface WorkflowJobData {
  executionId: string;
  workflowId: string;
  userId: string;
  input: Record<string, any>;
  primitives: any[]; // PrimitiveConfig[]
  enableContinueGates?: boolean; // Pause for user confirmation between steps
  userGroupId?: string | null;
}

let workflowQueueInstance: Queue<WorkflowJobData> | null = null;

try {
  const connection = getRedisClient();

  workflowQueueInstance = new Queue<WorkflowJobData>('workflow-executions', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100,
      },
      removeOnFail: false,
    },
  });

  logger.info('Workflow queue initialized successfully');
} catch (error) {
  logger.error('Failed to initialize workflow queue:', error);
  logger.info('Redis not available — workflow queue not initialized.');
}

export const getWorkflowQueue = (): Queue<WorkflowJobData> | null => {
  return workflowQueueInstance;
};

export const closeWorkflowQueue = async (): Promise<void> => {
  try {
    const forceCloseTimeout = setTimeout(() => {
      logger.warn('Force closing workflow queue after timeout');
      process.exit(0);
    }, 10000);

    if (workflowQueueInstance) {
      await workflowQueueInstance.close();
    }
    clearTimeout(forceCloseTimeout);
    logger.info('Workflow queue closed successfully');
  } catch (error) {
    logger.error('Error closing workflow queue:', error);
  }
};
