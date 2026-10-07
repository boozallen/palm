import logger from '@/server/logger';
import db from '@/server/db';
import {
  TimeRange,
  UserTrailEntry,
  UserTrailStats,
} from '@/features/context-studio/types/context-studio';
import { AuditRecordEvent, AuditRecordEventLabels } from '@/features/shared/types/audit-record';
import { buildAuditFilters } from '@/features/context-studio/dal/auditFilters';
import { sessionizedRecords } from '@/features/context-studio/dal/sessionizedRecords';

// A collapsed row from the gaps-and-islands query: either one discrete event or
// one aggregated run of consecutive navigation records.
type CollapsedRow = {
  kind: 'event' | 'run';
  id: string;
  event: string | null;
  outcome: string | null;
  description: string | null;
  started_at: Date;
  ended_at: Date;
  n: number;
  hrefs: string[] | null;
};

type CountRow = {
  total: number;
  meaningful: number;
  errors: number;
};

const label = (event: string | null): string => {
  if (!event) { return 'Activity'; }
  return AuditRecordEventLabels[event as AuditRecordEvent] ?? event;
};

// A single user's audit trail. Consecutive navigation-family records collapse
// into runs server-side (gaps-and-islands) so a heavy user's week — thousands of
// clicks — returns as a handful of run rows plus the discrete actions between
// them. Requires a concrete userId (the caller gates on a user being selected).
export default async function getUserActivity(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<UserTrailStats> {
  try {
    if (userId === 'all') {
      return { userId, userName: null, totalRecords: 0, meaningfulRecords: 0, errorRecords: 0, entries: [] };
    }

    const filters = buildAuditFilters(timeRange, userGroupId, userId, excludeAdmins);

    // Gaps-and-islands: is_nav flips define island boundaries; the difference of
    // two row numbers is constant within a maximal same-is_nav run. Runs of 2+
    // navigation records collapse; everything else stays a discrete event.
    const rows = await db.$queryRaw<CollapsedRow[]>`
      ${sessionizedRecords(filters)},
      user_rows AS (
        SELECT id, event, outcome, description, "timestamp",
               CASE WHEN event IN ('NAVIGATION', 'UI_INTERACTION') THEN 1 ELSE 0 END AS is_nav
        FROM sessionized
      ),
      grouped AS (
        SELECT *,
          ROW_NUMBER() OVER (ORDER BY "timestamp")
            - ROW_NUMBER() OVER (PARTITION BY is_nav ORDER BY "timestamp") AS grp
        FROM user_rows
      ),
      counted AS (
        SELECT *, COUNT(*) OVER (PARTITION BY is_nav, grp) AS grp_size
        FROM grouped
      )
      SELECT 'run' AS kind,
             -- Postgres has no min(uuid), so the run's id is derived from its
             -- text form; it only needs to be stable and unique per run.
             MIN(id::text) AS id,
             NULL::text AS event,
             NULL::text AS outcome,
             NULL::text AS description,
             MIN("timestamp") AS started_at,
             MAX("timestamp") AS ended_at,
             COUNT(*)::int AS n,
             array_remove(
               -- href is always the last "(...)" in the description; anchoring on
               -- the end of the string (rather than stopping at the label's first
               -- "(") avoids mistaking a parenthesized label like "Analysis (Q2)"
               -- for the href.
               array_agg(substring(description from '\\((/[^)]+)\\)[^(]*$') ORDER BY "timestamp"),
               NULL
             ) AS hrefs
      FROM counted
      WHERE is_nav = 1 AND grp_size >= 2
      GROUP BY grp
      UNION ALL
      SELECT 'event' AS kind,
             id::text, event, outcome, description,
             "timestamp" AS started_at,
             "timestamp" AS ended_at,
             1 AS n,
             ARRAY[]::text[] AS hrefs
      FROM counted
      WHERE is_nav = 0 OR (is_nav = 1 AND grp_size = 1)
      ORDER BY started_at ASC
    `;

    const [counts] = await db.$queryRaw<CountRow[]>`
      ${sessionizedRecords(filters)}
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE event NOT IN ('NAVIGATION', 'UI_INTERACTION'))::int AS meaningful,
             COUNT(*) FILTER (WHERE outcome = 'ERROR')::int AS errors
      FROM sessionized
    `;

    const nameRow = await db.$queryRaw<{ name: string | null }[]>`
      SELECT name FROM "User" WHERE id = CAST(${userId} AS UUID) LIMIT 1
    `;

    // Compute idle-before deltas in a single ascending pass.
    let prevEnd: number | null = null;
    const entries: UserTrailEntry[] = rows.map((row) => {
      const start = row.started_at.getTime();
      const idleBeforeMs = prevEnd === null ? 0 : Math.max(0, start - prevEnd);
      prevEnd = row.ended_at.getTime();

      if (row.kind === 'run') {
        return {
          kind: 'run',
          id: `run-${row.id}`,
          count: row.n,
          hrefs: row.hrefs ?? [],
          startedAt: row.started_at.toISOString(),
          endedAt: row.ended_at.toISOString(),
        };
      }
      return {
        kind: 'event',
        id: row.id,
        event: row.event ?? '',
        label: label(row.event),
        description: row.description ?? '',
        outcome: row.outcome ?? '',
        timestamp: row.started_at.toISOString(),
        idleBeforeMs,
      };
    });

    return {
      userId,
      userName: nameRow[0]?.name ?? null,
      totalRecords: counts?.total ?? 0,
      meaningfulRecords: counts?.meaningful ?? 0,
      errorRecords: counts?.errors ?? 0,
      entries,
    };
  } catch (error) {
    logger.error('Error fetching user activity', { error });
    throw new Error('Failed to fetch user activity');
  }
}
