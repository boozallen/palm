import logger from '@/server/logger';
import db from '@/server/db';
import { TimeRange, WorkflowStats } from '@/features/context-studio/types/context-studio';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';

export default async function getWorkflowStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
): Promise<WorkflowStats> {
  try {

    const getUserFilter = (userField: string) => buildUserScopeFilter(userField, userGroupId, userId);

    const [
      workflowCountResult,
      sharedWorkflowCountResult,
      acceptedWorkflowCountResult,
      rejectedWorkflowCountResult,
      workflowExecutionStatsResult,
    ] = await Promise.all([
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Workflow" w
        WHERE w."deletedAt" IS NULL
          ${buildTimeRangeFilter(timeRange, 'w."createdAt"')}
          ${getUserFilter('w."createdBy"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "shared_workflows" sw
        WHERE sw."deletedAt" IS NULL
          ${buildTimeRangeFilter(timeRange, 'sw."createdAt"')}
          ${getUserFilter('sw."sourceUserId"')}
      `.catch(() => {
        logger.debug('SharedWorkflow tables not found, skipping workflow share stats');
        return [{ count: BigInt(0) }];
      }),
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "shared_workflow_actions" swa
        WHERE swa.status = 'accepted'
          ${buildTimeRangeFilter(timeRange, 'swa."createdAt"')}
          ${getUserFilter('swa."userId"')}
      `.catch(() => [{ count: BigInt(0) }]),
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "shared_workflow_actions" swa
        WHERE swa.status = 'rejected'
          ${buildTimeRangeFilter(timeRange, 'swa."createdAt"')}
          ${getUserFilter('swa."userId"')}
      `.catch(() => [{ count: BigInt(0) }]),
      db.$queryRaw<{
        total: bigint;
        successful: bigint;
        failed: bigint;
        paused: bigint;
        cancelled: bigint;
      }[]>`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN we.status = 'completed' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN we.status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN we.status = 'paused' THEN 1 ELSE 0 END) as paused,
          SUM(CASE WHEN we.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        FROM "WorkflowExecution" we
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'we."startedAt"')}
          ${getUserFilter('we."triggeredBy"')}
      `,
    ]);

    return {
      total: Number(workflowCountResult[0]?.count || 0),
      shared: Number(sharedWorkflowCountResult[0]?.count || 0),
      accepted: Number(acceptedWorkflowCountResult[0]?.count || 0),
      rejected: Number(rejectedWorkflowCountResult[0]?.count || 0),
      executions: Number(workflowExecutionStatsResult[0]?.total || 0),
      successful: Number(workflowExecutionStatsResult[0]?.successful || 0),
      failed: Number(workflowExecutionStatsResult[0]?.failed || 0),
      paused: Number(workflowExecutionStatsResult[0]?.paused || 0),
      cancelled: Number(workflowExecutionStatsResult[0]?.cancelled || 0),
    };
  } catch (error) {
    logger.error('Error fetching workflow stats', { error });
    throw new Error('Failed to fetch workflow statistics');
  }
}
