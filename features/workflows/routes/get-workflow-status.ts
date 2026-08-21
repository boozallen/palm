import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import { getRedisClient } from '@/server/storage/redisConnection';
import getWorkflowExecution from '@/features/workflows/dal/getWorkflowExecution';

export const getWorkflowStatus = procedure
  .input(
    z.object({
      executionId: z.string().uuid(),
    })
  )
  .query(async ({ ctx, input }) => {
    const execution = await getWorkflowExecution(input.executionId, ctx.userId);

    if (!execution) {
      throw NotFound('Workflow execution not found');
    }

    const isCreator = execution.workflow.createdBy === ctx.userId;
    const isTriggeredBy = execution.triggeredBy === ctx.userId;
    const hasGroupAccess = execution.workflow.userGroups.some(
      (group: { userGroupMemberships: unknown[] }) => group.userGroupMemberships.length > 0
    );

    if (!isCreator && !isTriggeredBy && !hasGroupAccess) {
      throw Forbidden('You do not have permission to view this workflow execution');
    }

    let progress = null;
    try {
      const redis = getRedisClient();
      const progressKey = `workflow:execution:${input.executionId}:progress`;
      const progressData = await redis.get(progressKey);
      if (progressData) {
        progress = JSON.parse(progressData);
      }
    } catch {
      // Redis not available — fall back to database data only
    }

    // Strip large fields from every trace entry before returning to the client.
    // `input` can contain full document text; `config.promptText` is a transient
    // field used during execution and is not needed in the response.
    const stripLargeFields = (trace: any[]): any[] =>
      trace.map(({ input: _input, config, ...rest }: any) => {
        if (!config) { return rest; }
        const { promptText: _pt, ...configWithout } = config;
        return { ...rest, config: configWithout };
      });

    const dbTrace = execution.trace ? stripLargeFields(execution.trace as any[]) : null;
    const liveTrace = progress?.trace ? stripLargeFields(progress.trace) : null;

    const artifactGithubPages: Record<string, string | null> = {};
    for (const artifact of execution.artifacts) {
      artifactGithubPages[artifact.id] = artifact.githubPagesUrl ?? null;
    }

    return {
      execution: {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        triggeredBy: execution.triggeredBy,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        error: execution.error,
        input: execution.input as Record<string, any>,
        output: execution.output as Record<string, any> | null,
        trace: dbTrace,
        artifactGithubPages,
        // state omitted — only used by removed subflow code paths
      },
      progress: progress
        ? {
            trace: liveTrace,
            partialOutput: progress.partialOutput,
            updatedAt: progress.updatedAt,
          }
        : null,
    };
  });
