import { Prisma } from '@prisma/client';

import { buildWindowFilter, buildSinceWindowFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { MetricWithDelta } from '@/features/context-studio/types/value';
import db from '@/server/db';
import logger from '@/server/logger';

export type AdoptionMetrics = {
  provisionedPeople: number;
  activePeople: MetricWithDelta;
  returningPeople: MetricWithDelta;
  // Distinct (person, group) pairs behind activePeople.value, one pair per group
  // a person's current-window activity was actually attributed to (null when an
  // action carried no attribution). Returned so the per-team table can bucket by
  // real attribution rather than re-deriving activity with a second query.
  activeAttributions: { userId: string; userGroupId: string | null }[];
};

// Distinct ISO weeks of activity that make someone a returning user. From the
// spec: three separate weeks, not three sessions — a single busy afternoon is
// trying the tool, three separate weeks is a habit.
const RETURNING_WEEK_THRESHOLD = 3;

type AdoptionRow = {
  provisioned: number | null;
  active_attributions: { userId: string; userGroupId: string | null }[] | null;
  active_previous: number | null;
  returning_current: number | null;
  returning_previous: number | null;
};

const count = (value: number | null | undefined): number => Number(value ?? 0);

// Adoption for the Value view: how many people we pay for, how many actually
// used the tool, and how many came back. Activity is doing something — sending a
// chat turn (ordinary, agentic, or launched from a Library prompt), running a
// workflow, or running an agent — never signing in.
export default async function getAdoptionMetrics(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<AdoptionMetrics> {
  try {
    const adminFilter = excludeAdmins
      ? Prisma.sql`AND u.role <> 'Admin'`
      : Prisma.empty;

    // Counts are cast in SQL: an uncast COUNT(*) comes back from $queryRaw as a
    // BigInt, which JSON.stringify refuses to serialize over tRPC.
    const rows = await db.$queryRaw<AdoptionRow[]>`
      WITH scoped_users AS (
        SELECT u.id
        FROM "User" u
        WHERE 1=1
          ${adminFilter}
          ${buildUserScopeFilter('u.id', userGroupId, userId)}
      ),
      activity AS (
        -- Chat, including agentic chat and any chat launched from a Library
        -- prompt: all three go through the add-message route, which persists the
        -- turn as a role='user' ChatMessage before it branches on
        -- agentProviderId. One arm covers them, and adding a second for agent
        -- chats would double-count every agentic turn.
        SELECT c."userId" AS user_id, cm."createdAt" AS at, c."userGroupId" AS user_group_id
        FROM "ChatMessage" cm
        JOIN "Chat" c ON c.id = cm."chatId"
        WHERE cm.role = 'user'
          ${buildSinceWindowFilter(timeRange, 'cm."createdAt"', 'previous')}
        UNION ALL
        SELECT we."triggeredBy" AS user_id, we."startedAt" AS at, we."userGroupId" AS user_group_id
        FROM "WorkflowExecution" we
        WHERE 1=1
          ${buildSinceWindowFilter(timeRange, 'we."startedAt"', 'previous')}
        -- Agent runs produce no chat at all, so without these three arms someone
        -- whose only use of the tool was running an agent counted as provisioned
        -- but never as active, and could never become a returning user.
        UNION ALL
        SELECT pj."userId" AS user_id, pj."createdAt" AS at, pj."userGroupId" AS user_group_id
        FROM "AgentPrismJob" pj
        WHERE 1=1
          ${buildSinceWindowFilter(timeRange, 'pj."createdAt"', 'previous')}
        UNION ALL
        SELECT oj."userId" AS user_id, oj."createdAt" AS at, oj."userGroupId" AS user_group_id
        FROM "AgentOdramJob" oj
        WHERE 1=1
          ${buildSinceWindowFilter(timeRange, 'oj."createdAt"', 'previous')}
        -- Written by the LangGraph service rather than this app, which is why it
        -- is snake_cased and has no Prisma-side write path, and no userGroupId of
        -- its own. getAgentServiceStats already treats its userId as an end user,
        -- so it is scoped the same way; its activity is always unattributed.
        UNION ALL
        SELECT ath."userId" AS user_id, ath."createdAt" AS at, NULL::uuid AS user_group_id
        FROM "agent_threads" ath
        WHERE 1=1
          ${buildSinceWindowFilter(timeRange, 'ath."createdAt"', 'previous')}
      ),
      scoped_activity AS (
        SELECT a.user_id, a.at, a.user_group_id
        FROM activity a
        JOIN scoped_users s ON s.id = a.user_id
      ),
      current_activity AS (
        SELECT * FROM scoped_activity
        WHERE 1=1 ${buildWindowFilter(timeRange, 'at', 'current')}
      ),
      previous_activity AS (
        SELECT * FROM scoped_activity
        WHERE 1=1 ${buildWindowFilter(timeRange, 'at', 'previous')}
      )
      SELECT
        (SELECT COUNT(*)::int FROM scoped_users) AS provisioned,
        (
          SELECT COALESCE(
            jsonb_agg(jsonb_build_object('userId', user_id, 'userGroupId', user_group_id)),
            '[]'::jsonb
          )
          FROM (SELECT DISTINCT user_id, user_group_id FROM current_activity) distinct_attributions
        ) AS active_attributions,
        (SELECT COUNT(DISTINCT user_id)::int FROM previous_activity) AS active_previous,
        (
          SELECT COUNT(*)::int FROM (
            SELECT user_id
            FROM current_activity
            GROUP BY user_id
            HAVING COUNT(DISTINCT date_trunc('week', at)) >= ${RETURNING_WEEK_THRESHOLD}
          ) returning_now
        ) AS returning_current,
        (
          SELECT COUNT(*)::int FROM (
            SELECT user_id
            FROM previous_activity
            GROUP BY user_id
            HAVING COUNT(DISTINCT date_trunc('week', at)) >= ${RETURNING_WEEK_THRESHOLD}
          ) returning_before
        ) AS returning_previous
    `;

    const row = rows[0];
    const activeAttributions = row?.active_attributions ?? [];
    const activeUserIds = new Set(activeAttributions.map((attribution) => attribution.userId));

    return {
      provisionedPeople: count(row?.provisioned),
      activePeople: {
        value: activeUserIds.size,
        previous: count(row?.active_previous),
      },
      returningPeople: {
        value: count(row?.returning_current),
        previous: count(row?.returning_previous),
      },
      activeAttributions,
    };
  } catch (error) {
    logger.error('Failed to aggregate Context Studio adoption metrics', { error });
    throw new Error('Failed to fetch adoption metrics');
  }
}
