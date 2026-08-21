import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';
import { getRedisClient } from '@/server/storage/redisConnection';
import getWorkflowExecution from '@/features/workflows/dal/getWorkflowExecution';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import { WorkflowStatus } from '@/features/workflows/types/workflow';
import { getWorkflowQueue } from '@/features/workflows/utils/worker/queue';

export const cancelWorkflowExecution = procedure
  .input(
    z.object({
      executionId: z.string().uuid(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      throw Forbidden('You do not have access to workflows');
    }

    const execution = await getWorkflowExecution(input.executionId, ctx.userId);

    if (!execution) {
      throw NotFound('Workflow execution not found');
    }

    // Check if user has permission to cancel this execution
    if (execution.triggeredBy !== ctx.userId) {
      throw Forbidden('You do not have permission to control this workflow execution');
    }

    // Check if execution is in a cancellable status
    if (execution.status !== WorkflowStatus.PAUSED && execution.status !== WorkflowStatus.RUNNING) {
      throw new Error('Workflow execution cannot be cancelled');
    }

    try {
      const redis = getRedisClient();

      // Set cancellation key in Redis (expires after 10 minutes)
      const cancellationKey = `workflow:execution:${input.executionId}:cancel`;
      await redis.setex(cancellationKey, 600, '1');

      // If execution is paused, also set the approval key for immediate cancellation
      if (execution.status === WorkflowStatus.PAUSED) {
        const approvalKey = `workflow:execution:${input.executionId}:approval`;
        await redis.set(approvalKey, 'cancel', 'EX', 5);
      }

      // Try to remove the job from the queue if it's still waiting
      const queue = getWorkflowQueue();
      if (queue) {
        const job = await queue.getJob(input.executionId);
        if (job) {
          const state = await job.getState();
          if (state === 'waiting' || state === 'delayed') {
            await job.remove();
          }
        }
      }

      logger.info(`User ${ctx.userId} cancelled workflow execution ${input.executionId}`);

      return {
        success: true,
        message: 'Workflow execution cancellation initiated',
      };
    } catch (error) {
      logger.error('Failed to cancel workflow execution:', error);
      throw new Error('Failed to cancel workflow execution');
    }
  });
