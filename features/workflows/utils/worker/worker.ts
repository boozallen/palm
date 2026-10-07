/**
 * Workflow Executor - processes workflow jobs from the queue
 */

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import { WorkflowJobData } from '@/features/workflows/utils/worker/queue';
import { PrimitiveFactory } from '@/features/workflows/primitives/PrimitiveFactory';
import {
  PrimitiveContext,
  PrimitiveConfig,
  PrimitiveResult,
  PrimitiveType,
} from '@/features/workflows/types/primitive';
import { WorkflowStatus, PrimitiveExecutionTrace } from '@/features/workflows/types/workflow';
import prisma from '@/server/db';
import { AIFactory } from '@/features/ai-provider/factory';
import { sanitizeForPostgres } from '@/features/workflows/utils/sanitize';
import { reportJobFailure } from '@/server/reportJobFailure';

export class WorkflowExecutor {
  private worker: Worker<WorkflowJobData> | null = null;

  async start() {
    try {
      const connection = getRedisClient();

      this.worker = new Worker<WorkflowJobData>(
        'workflow-executions',
        async (job: Job<WorkflowJobData>) => {
          return await this.processWorkflow(job);
        },
        {
          connection,
          concurrency: 3,
          limiter: {
            max: 10,
            duration: 1000,
          },
        }
      );

      this.worker.on('completed', (job) => {
        logger.info(`Workflow job ${job.id} completed`);
      });

      this.worker.on('failed', (job, err) => {
        logger.error(`Workflow job ${job?.id} failed:`, err);
        reportJobFailure(job, err);
      });

      logger.info('Workflow executor started');
    } catch (error) {
      logger.error('Failed to start workflow executor:', error);
    }
  }

  async stop() {
    if (this.worker) {
      await this.worker.close();
      logger.info('Workflow executor stopped');
    }
  }

  private async processWorkflow(job: Job<WorkflowJobData>) {
    const { executionId, workflowId, userId, input, primitives, enableContinueGates, userGroupId } = job.data;

    logger.info(`Processing workflow execution ${executionId}`);

    await this.updateExecutionStatus(executionId, WorkflowStatus.RUNNING);

    const allPrimitives = primitives as PrimitiveConfig[];
    const completed = new Set<string>();
    const state: Record<string, any> = {};
    const trace: PrimitiveExecutionTrace[] = [];

    try {
      while (completed.size < allPrimitives.length) {
        // Check if workflow has been cancelled
        const redis = getRedisClient();
        const cancellationKey = `workflow:execution:${executionId}:cancel`;
        const isCancelled = await redis.get(cancellationKey);

        if (isCancelled) {
          await this.updateExecutionStatus(
            executionId,
            WorkflowStatus.CANCELLED,
            trace,
            undefined,
            'Execution cancelled by user',
          );
          return { status: 'cancelled', trace };
        }

        // Find all nodes whose predecessors have all completed
        const wave = allPrimitives.filter((p) => {
          if (completed.has(p.id)) { return false; }
          return (p.predecessorIds ?? []).every((id) => completed.has(id));
        });

        if (wave.length === 0) {
          throw new Error(
            'Workflow stalled: no nodes are ready to run. Check for disconnected nodes or missing connections.'
          );
        }

        // Write "running" entries to Redis for all nodes starting this wave.
        const runningEntries: PrimitiveExecutionTrace[] = await Promise.all(
          wave.map(async (p) => {
            let metadata: Record<string, unknown> | undefined;
            if (p.type === PrimitiveType.PROMPT) {
              const promptConfig = p.config as { model?: string; promptId?: string };
              if (promptConfig.promptId) {
                const record = await prisma.prompt.findUnique({
                  where: { id: promptConfig.promptId },
                  select: { instructions: true },
                });
                metadata = { model: promptConfig.model, prompt: record?.instructions };
              }
            }
            return {
              primitiveId: p.id,
              primitiveName: p.name,
              primitiveType: p.type,
              startedAt: new Date(),
              completedAt: undefined as any,
              status: 'running' as any,
              input: this.buildContextInput(p, state, input),
              config: p.config,
              metadata,
            };
          })
        );
        await this.storeProgress(executionId, [...trace, ...runningEntries], {}, state);

        // Execute all nodes in this wave in parallel
        const waveResults = await Promise.all(
          wave.map((primitiveConfig) => {
            const context: PrimitiveContext = {
              input: this.buildContextInput(primitiveConfig, state, input),
              state,
              workflowId,
              executionId,
              userId,
            };
            return this.executePrimitive(primitiveConfig, context, userId, userGroupId);
          })
        );

        // Process results — write outputs to state, check for errors
        for (const traceEntry of waveResults) {
          trace.push(traceEntry);
          state[traceEntry.primitiveId] = traceEntry.output;
          completed.add(traceEntry.primitiveId);

          if (traceEntry.status === 'error') {
            throw new Error(traceEntry.error || 'Primitive execution failed');
          }
        }

        await this.storeProgress(executionId, trace, {}, state);

        // If continue gates are enabled and there are more primitives to execute,
        // pause for user confirmation
        if (enableContinueGates && completed.size < allPrimitives.length) {
          await this.updateExecutionStatus(executionId, WorkflowStatus.PAUSED, trace);

          // Wait for user to approve continuation
          const shouldContinue = await this.waitForUserApproval(executionId);

          if (!shouldContinue) {
            await this.updateExecutionStatus(
              executionId,
              WorkflowStatus.CANCELLED,
              trace,
              undefined,
              'Execution cancelled by user',
            );
            return { status: 'cancelled', trace };
          }

          // Resume execution
          await this.updateExecutionStatus(executionId, WorkflowStatus.RUNNING, trace);
        }
      }

      // The terminal node is the one no other node lists as a predecessor
      const allPredecessorIds = new Set(allPrimitives.flatMap((p) => p.predecessorIds ?? []));
      const terminalNode = allPrimitives.find((p) => !allPredecessorIds.has(p.id));
      const finalOutput = terminalNode ? (state[terminalNode.id] ?? {}) : {};

      await this.updateExecutionStatus(
        executionId,
        WorkflowStatus.COMPLETED,
        trace,
        finalOutput,
      );

      logger.info(`Workflow execution ${executionId} completed successfully`);

      return { status: 'completed', output: finalOutput, trace };
    } catch (error) {
      logger.error(`Workflow execution ${executionId} failed:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.updateExecutionStatus(
        executionId,
        WorkflowStatus.FAILED,
        trace,
        undefined,
        errorMessage,
      );

      throw error;
    }
  }

  /**
   * Builds context.input for a node:
   * - No predecessors: receives the workflow's initial input
   * - One predecessor: receives that predecessor's output directly
   * - Multiple predecessors: merges all predecessor outputs; string values
   *   sharing the same key are concatenated with a separator so every
   *   predecessor's content is visible to the receiving node.
   */
  private buildContextInput(
    primitive: PrimitiveConfig,
    state: Record<string, any>,
    workflowInput: Record<string, any>,
  ): Record<string, any> {
    const preds = primitive.predecessorIds ?? [];
    if (preds.length === 0) { return workflowInput; }
    if (preds.length === 1) { return state[preds[0]] ?? {}; }

    const merged: Record<string, any> = {};
    for (const predId of preds) {
      const output = state[predId];
      if (!output) { continue; }
      for (const [key, value] of Object.entries(output)) {
        if (key in merged) {
          if (typeof merged[key] === 'string' && typeof value === 'string') {
            merged[key] = `${merged[key]}\n\n---\n\n${value}`;
          } else if (Array.isArray(merged[key]) && Array.isArray(value)) {
            merged[key] = [...merged[key], ...value];
          }
        } else {
          merged[key] = value;
        }
      }
    }
    return merged;
  }

  private async executePrimitive(
    config: PrimitiveConfig,
    context: PrimitiveContext,
    userId: string,
    userGroupId?: string | null
  ): Promise<PrimitiveExecutionTrace> {
    const startTime = new Date();

    logger.info(`Executing primitive ${config.id} (${config.type})`);

    try {
      // Build AI provider if needed for LLM primitives
      let ai;
      if (config.type === PrimitiveType.PROMPT) {
        const promptConfig = config.config as any;
        if (promptConfig.model) {
          const factory = new AIFactory({ userId, userGroupId: userGroupId ?? undefined });
          // Attribute this call to the primitive that made it, so per-artifact
          // cost can be resolved by walking the DAG from each artifact primitive
          // back to its upstream prompt primitives.
          ai = await factory.buildUserSource(promptConfig.model, {
            attribution: {
              workflowExecutionId: context.executionId,
              primitiveId: config.id,
              stepLabel: config.name,
            },
          });
        }
      }

      // Create primitive instance
      const primitive = PrimitiveFactory.create(config, ai);

      // Validate primitive
      const validation = await primitive.validate();
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
      }

      // Log what this primitive is receiving as input
      const inputSummary = Array.isArray(context.input.documents)
        ? `documents=[${(context.input.documents as Array<{ name?: string }>).map((d) => d.name ?? 'unnamed').join(', ')}]`
        : Object.keys(context.input).join(', ') || '(empty)';
      const predecessorSummary = config.predecessorIds && config.predecessorIds.length > 0
        ? ` predecessors=[${config.predecessorIds.join(', ')}]`
        : '';
      logger.info(`Primitive ${config.id} (${config.type}) input: ${inputSummary}${predecessorSummary}`);

      // Execute primitive
      const result: PrimitiveResult = await primitive.execute(context);

      // Log what this primitive produced as output
      const outputSummary = result.output
        ? Object.keys(result.output).join(', ')
        : '(none)';
      logger.info(`Primitive ${config.id} (${config.type}) output keys: ${outputSummary}`);

      return {
        primitiveId: config.id,
        primitiveName: config.name,
        primitiveType: config.type,
        startedAt: startTime,
        completedAt: new Date(),
        status: result.status,
        input: context.input,
        output: result.output,
        error: result.error,
        metadata: result.metadata,
        config: config.config,
      };
    } catch (error) {
      logger.error(`Primitive ${config.id} failed:`, error);

      return {
        primitiveId: config.id,
        primitiveName: config.name,
        primitiveType: config.type,
        startedAt: startTime,
        completedAt: new Date(),
        status: 'error',
        input: context.input,
        error: error instanceof Error ? error.message : 'Unknown error',
        config: config.config,
      };
    }
  }

  private async updateExecutionStatus(
    executionId: string,
    status: WorkflowStatus,
    trace?: PrimitiveExecutionTrace[],
    output?: Record<string, any>,
    error?: string,
  ) {
    try {
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: status.toString(),
          trace: trace ? sanitizeForPostgres(trace) as any : undefined,
          output: output ? sanitizeForPostgres(output) as any : undefined,
          error,
          completedAt:
            status === WorkflowStatus.COMPLETED ||
            status === WorkflowStatus.FAILED
              ? new Date()
              : undefined,
        },
      });
    } catch (error) {
      logger.error('Failed to update execution status:', error);
    }
  }

  private async storeProgress(
    executionId: string,
    trace: PrimitiveExecutionTrace[],
    partialOutput: Record<string, any>,
    state?: Record<string, any>
  ) {
    try {
      const redis = getRedisClient();
      const key = `workflow:execution:${executionId}:progress`;

      await redis.set(
        key,
        JSON.stringify({
          trace,
          partialOutput,
          state,
          updatedAt: new Date().toISOString(),
        }),
        'EX',
        3600 // Expire after 1 hour
      );
    } catch (error) {
      logger.warn('Failed to store progress in Redis:', error);
    }
  }

  /**
   * Wait for user approval to continue workflow execution
   * Returns true if user approved, false if cancelled
   */
  private async waitForUserApproval(executionId: string): Promise<boolean> {
    const redis = getRedisClient();
    const approvalKey = `workflow:execution:${executionId}:approval`;

    // Poll Redis for user decision (max 1 hour timeout)
    const maxWaitTime = 60 * 60 * 1000; // 1 hour
    const pollInterval = 1000; // 1 second
    const maxAttempts = maxWaitTime / pollInterval;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const decision = await redis.get(approvalKey);

        if (decision === 'continue') {
          // Clear the approval key
          await redis.del(approvalKey);
          return true;
        }

        if (decision === 'cancel') {
          // Clear the approval key
          await redis.del(approvalKey);
          return false;
        }

        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        logger.error('Error polling for user approval:', error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    // Timeout - treat as cancellation
    logger.warn(`Workflow execution ${executionId} timed out waiting for approval`);
    return false;
  }

}

// Singleton instance
let executorInstance: WorkflowExecutor | null = null;

export const getWorkflowExecutor = (): WorkflowExecutor => {
  if (!executorInstance) {
    executorInstance = new WorkflowExecutor();
  }
  return executorInstance;
};

export const startWorkflowWorker = async () => {
  const executor = getWorkflowExecutor();
  await executor.start();
};

export const stopWorkflowWorker = async () => {
  if (executorInstance) {
    await executorInstance.stop();
  }
};
