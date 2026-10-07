import { Prisma } from '@prisma/client';

import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';
import { SESSION_GAP } from '@/features/context-studio/dal/sessionizedRecords';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';
import db from '@/server/db';
import logger from '@/server/logger';

const SECONDS_PER_HOUR = 3600;

// Total measured time people spent in the tool, derived the same way PR #774
// derives per-conversation visits: navigation rows from "AuditRecord", the next
// event per user found with LEAD(), the gap between them treated as a visit.
//
// This is time SPENT, never time saved — the Value view must not present it as a
// saving. See the spec's "what this design refuses to fabricate" section.
export default async function getTimeInTool(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<number> {
  try {
    const adminFilter = excludeAdmins
      ? Prisma.sql`AND ar."userId" NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`
      : Prisma.empty;

    const rows = await db.$queryRaw<{ total_seconds: number | null }[]>`
      WITH page_events AS (
        SELECT ar."userId", ar."timestamp",
          -- href is always the last "(...)" in the description, so anchor on the
          -- end of the string rather than stopping at the label's first "(".
          substring(ar.description from '\\((/[^)]+)\\)[^(]*$') AS href
        FROM "AuditRecord" ar
        WHERE ar."userId" IS NOT NULL
          AND ar.event IN (
            ${AuditRecordEvent.Navigation},
            ${AuditRecordEvent.UserSignOut},
            ${AuditRecordEvent.UserSessionExpired}
          )
          ${buildTimeRangeFilter(timeRange, 'ar."timestamp"')}
          ${buildUserScopeFilter('ar."userId"', userGroupId, userId)}
          ${adminFilter}
      ),
      with_next AS (
        SELECT *,
          LEAD("timestamp") OVER (PARTITION BY "userId" ORDER BY "timestamp") AS next_timestamp
        FROM page_events
      ),
      visits AS (
        SELECT
          "timestamp" AS entered_at,
          -- Capped at SESSION_GAP, unlike searchChats: an unbounded gap would
          -- count an idle afternoon between two clicks as hours of engagement.
          LEAST(
            COALESCE(next_timestamp, "timestamp" + ${SESSION_GAP()}),
            "timestamp" + ${SESSION_GAP()}
          ) AS left_at
        FROM with_next
        WHERE href IS NOT NULL
      )
      SELECT SUM(EXTRACT(EPOCH FROM (left_at - entered_at))) AS total_seconds
      FROM visits
    `;

    const totalSeconds = Number(rows[0]?.total_seconds ?? 0);
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      return 0;
    }

    return Math.round((totalSeconds / SECONDS_PER_HOUR) * 10) / 10;
  } catch (error) {
    logger.error('Failed to aggregate measured time in tool from navigation records', { error });
    throw new Error('Failed to fetch measured time in tool');
  }
}
