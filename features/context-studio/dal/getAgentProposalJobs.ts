import logger from '@/server/logger';
import db from '@/server/db';
import { AgentProposalJob, TimeRange } from '@/features/context-studio/types/context-studio';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';

export const AGENT_PROPOSAL_JOBS_LIMIT = 200;

type AgentProposalJobRow = Omit<AgentProposalJob, 'createdAt'> & { createdAt: Date };

export default async function getAgentProposalJobs(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
): Promise<AgentProposalJob[]> {
  try {
    const rows = await db.$queryRaw<AgentProposalJobRow[]>`
      SELECT * FROM (
        SELECT
          apj.id AS "jobId",
          'PRISM' AS "agentType",
          aa.name AS "agentName",
          apj.status,
          apj."createdAt",
          apj."proposalName",
          apj."clientName",
          apj."opportunitySummary",
          apj."financialValue",
          apj."proposalFilename" AS "fallbackFilename",
          u.name AS "userName",
          u.email AS "userEmail"
        FROM "AgentPrismJob" apj
        JOIN "AiAgent" aa ON aa.id = apj."aiAgentId"
        JOIN "User" u ON u.id = apj."userId"
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'apj."createdAt"')}
          ${buildUserScopeFilter('apj."userId"', userGroupId, userId, 'apj."userGroupId"')}
        UNION ALL
        SELECT
          aoj.id AS "jobId",
          'ODRAM' AS "agentType",
          aa.name AS "agentName",
          aoj.status,
          aoj."createdAt",
          aoj."proposalName",
          aoj."clientName",
          aoj."opportunitySummary",
          aoj."financialValue",
          aoj."odramFilename" AS "fallbackFilename",
          u.name AS "userName",
          u.email AS "userEmail"
        FROM "AgentOdramJob" aoj
        JOIN "AiAgent" aa ON aa.id = aoj."aiAgentId"
        JOIN "User" u ON u.id = aoj."userId"
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'aoj."createdAt"')}
          ${buildUserScopeFilter('aoj."userId"', userGroupId, userId, 'aoj."userGroupId"')}
      ) jobs
      ORDER BY "createdAt" DESC
      LIMIT ${AGENT_PROPOSAL_JOBS_LIMIT}
    `;

    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  } catch (error) {
    logger.error('Error fetching agent proposal jobs', { error });
    throw new Error('Failed to fetch agent proposal jobs');
  }
}
