import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';
import { getRedisClient } from '@/server/storage/redisConnection';
import getWorkflowExecution from '@/features/workflows/dal/getWorkflowExecution';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import { WorkflowStatus } from '@/features/workflows/types/workflow';

export const continueWorkflowExecution = procedure
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

    // Check if user has permission to continue this execution
    if (execution.triggeredBy !== ctx.userId) {
      throw Forbidden('You do not have permission to control this workflow execution');
    }

    // Check if execution is in paused status
    if (execution.status !== WorkflowStatus.PAUSED) {
      throw new Error('Workflow execution is not paused');
    }

    try {
      const redis = getRedisClient();
      const approvalKey = `workflow:execution:${input.executionId}:approval`;

      // Set approval decision in Redis (expires after 5 seconds)
      await redis.set(approvalKey, 'continue', 'EX', 5);

      logger.info(`User ${ctx.userId} approved continuation of workflow execution ${input.executionId}`);

      return {
        success: true,
        message: 'Workflow execution will continue',
      };
    } catch (error) {
      logger.error('Failed to continue workflow execution:', error);
      throw new Error('Failed to continue workflow execution');
    }
  });
