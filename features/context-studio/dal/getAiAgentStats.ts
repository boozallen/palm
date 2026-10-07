import logger from '@/server/logger';
import db from '@/server/db';
import { TimeRange, AiAgentStats } from '@/features/context-studio/types/context-studio';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';

export default async function getAiAgentStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
): Promise<AiAgentStats> {
  try {

    const getUserFilter = (userField: string) => buildUserScopeFilter(userField, userGroupId, userId);

    const [
      configuredAgentsResult,
      prismJobCountResult,
      prismJobStatusResult,
      odramJobCountResult,
      odramJobStatusResult,
      marginAnalysisCountResult,
      uniqueAgentUsersResult,
    ] = await Promise.all([
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT aa.id) as count
        FROM "AiAgent" aa
        WHERE 1=1
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "AgentPrismJob" apj
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'apj."createdAt"')}
          ${getUserFilter('apj."userId"')}
      `,
      db.$queryRaw<{ completed: bigint; inProgress: bigint }[]>`
        SELECT
          SUM(CASE WHEN apj.status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN apj.status IN ('processing', 'pending') THEN 1 ELSE 0 END) as "inProgress"
        FROM "AgentPrismJob" apj
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'apj."createdAt"')}
          ${getUserFilter('apj."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "AgentOdramJob" aoj
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'aoj."createdAt"')}
          ${getUserFilter('aoj."userId"')}
      `,
      db.$queryRaw<{ completed: bigint; inProgress: bigint }[]>`
        SELECT
          SUM(CASE WHEN aoj.status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN aoj.status IN ('processing', 'pending') THEN 1 ELSE 0 END) as "inProgress"
        FROM "AgentOdramJob" aoj
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'aoj."createdAt"')}
          ${getUserFilter('aoj."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "margin_analyses" ma
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'ma."createdAt"')}
          ${getUserFilter('ma."userId"')}
      `.catch(() => {
        logger.debug('MarginAnalysis table not found, skipping margin analysis stats');
        return [{ count: BigInt(0) }];
      }),
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT user_id) as count
        FROM (
          SELECT apj."userId" as user_id
          FROM "AgentPrismJob" apj
          WHERE 1=1
            ${buildTimeRangeFilter(timeRange, 'apj."createdAt"')}
            ${getUserFilter('apj."userId"')}
          UNION
          SELECT aoj."userId" as user_id
          FROM "AgentOdramJob" aoj
          WHERE 1=1
            ${buildTimeRangeFilter(timeRange, 'aoj."createdAt"')}
            ${getUserFilter('aoj."userId"')}
        ) AS combined_users
      `.catch(() => {
        logger.debug('Error fetching unique agent users, potentially due to missing tables');
        return [{ count: BigInt(0) }];
      }),
    ]);

    const configuredAgentsCount = Number(configuredAgentsResult[0]?.count || 0);
    const prismJobCount = Number(prismJobCountResult[0]?.count || 0);
    const prismJobStatus = {
      completed: Number(prismJobStatusResult[0]?.completed || 0),
      inProgress: Number(prismJobStatusResult[0]?.inProgress || 0),
    };
    const odramJobCount = Number(odramJobCountResult[0]?.count || 0);
    const odramJobStatus = {
      completed: Number(odramJobStatusResult[0]?.completed || 0),
      inProgress: Number(odramJobStatusResult[0]?.inProgress || 0),
    };
    const marginAnalysisCount = Number(marginAnalysisCountResult[0]?.count || 0);
    const uniqueAgentUsersCount = Number(uniqueAgentUsersResult[0]?.count || 0);

    return {
      configured: configuredAgentsCount,
      reportsGenerated: prismJobStatus.completed + odramJobStatus.completed,
      uniqueUsers: uniqueAgentUsersCount,
      prismJobs: prismJobCount,
      prismCompleted: prismJobStatus.completed,
      prismInProgress: prismJobStatus.inProgress,
      odramJobs: odramJobCount,
      odramCompleted: odramJobStatus.completed,
      odramInProgress: odramJobStatus.inProgress,
      marginAnalyses: marginAnalysisCount,
    };
  } catch (error) {
    logger.error('Error fetching AI agent stats', { error });
    throw new Error('Failed to fetch AI agent statistics');
  }
}
