import logger from '@/server/logger';
import db from '@/server/db';
import {
  ActivitySession,
  ActivityStats,
  ActivityUser,
  TimeRange,
} from '@/features/context-studio/types/context-studio';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';
import { buildAuditFilters } from '@/features/context-studio/dal/auditFilters';
import { sessionizedRecords } from '@/features/context-studio/dal/sessionizedRecords';
import { collapseConsecutiveRepeats, describeEvent } from '@/features/context-studio/dal/eventLabels';

// A session's hover card shows its path as chips; beyond this many steps the
// card would wrap past the panel, so the tail folds into one summary chip. The
// sign-in/sign-out bookends are rendered separately and don't count against it.
const MAX_PATH_STEPS = 12;

type EventRow = {
  userId: string;
  userName: string | null;
  session_no: number;
  event: string;
  description: string | null;
  timestamp: Date;
};

// One block per session, with the session's ordered path, aggregated from the
// shared sessionized CTE. `viewerId` is the signed-in user, pinned to the top of
// the swimlane and flagged so the client can tint that row.
export default async function getActivityStrips(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
  viewerId?: string,
): Promise<ActivityStats> {
  try {
    const filters = buildAuditFilters(timeRange, userGroupId, userId, excludeAdmins);

    const rows = await db.$queryRaw<EventRow[]>`
      ${sessionizedRecords(filters)}
      SELECT "userId", "userName", session_no, event, description, "timestamp"
      FROM sessionized
      ORDER BY "userId", "timestamp" ASC
    `;

    // Walk the ordered rows, cutting a session whenever (userId, session_no)
    // changes. Rows arrive grouped by user and ascending in time, so a session
    // is always a contiguous run.
    const sessions: ActivitySession[] = [];
    const userNames = new Map<string, string>();
    const sessionsPerUser = new Map<string, number>();
    const eventsPerUser = new Map<string, number>();
    let totalEvents = 0;
    let signedInSessions = 0;
    let signedOutSessions = 0;
    let rangeStart = Infinity;
    let rangeEnd = -Infinity;

    let current: EventRow[] = [];

    const flush = () => {
      if (current.length === 0) { return; }
      const first = current[0];
      const last = current[current.length - 1];
      const key = first.userId;

      // Sessionization cuts on sign-in and after sign-out, so an auth event can
      // only ever be this run's first or last record. Lift those out of the path
      // — the client draws them as bookends, which keeps them visible even when
      // the middle of a long path folds into a "+n more" chip.
      const startedBySignIn = first.event === AuditRecordEvent.UserSignIn;
      const endedBySignOut = last.event === AuditRecordEvent.UserSignOut;
      const middle = current.slice(
        startedBySignIn ? 1 : 0,
        endedBySignOut ? current.length - 1 : current.length,
      );

      const steps = collapseConsecutiveRepeats(
        middle.map((row) => describeEvent(row.event, row.description)),
      ).map((step) => step.label);
      const path = steps.length > MAX_PATH_STEPS
        ? [...steps.slice(0, MAX_PATH_STEPS), `+${steps.length - MAX_PATH_STEPS} more`]
        : steps;

      sessions.push({
        id: `${key}:${first.session_no}`,
        userId: key,
        userName: first.userName ?? 'Unknown user',
        startedAt: first.timestamp.toISOString(),
        endedAt: last.timestamp.toISOString(),
        eventCount: current.length,
        path,
        startedBySignIn,
        endedBySignOut,
      });

      userNames.set(key, first.userName ?? 'Unknown user');
      sessionsPerUser.set(key, (sessionsPerUser.get(key) ?? 0) + 1);
      eventsPerUser.set(key, (eventsPerUser.get(key) ?? 0) + current.length);
      totalEvents += current.length;
      if (startedBySignIn) { signedInSessions += 1; }
      if (endedBySignOut) { signedOutSessions += 1; }
      rangeStart = Math.min(rangeStart, first.timestamp.getTime());
      rangeEnd = Math.max(rangeEnd, last.timestamp.getTime());

      current = [];
    };

    let key: string | null = null;
    for (const row of rows) {
      const rowKey = `${row.userId}:${row.session_no}`;
      if (rowKey !== key) {
        flush();
        key = rowKey;
      }
      current.push(row);
    }
    flush();

    // Display order: the viewer pinned first, then the busiest users by session
    // count — this view is for scanning, so the densest rows lead.
    const users: ActivityUser[] = Array.from(userNames.entries())
      .map(([id, name]) => ({ id, name, isSelf: id === viewerId }))
      .sort((a, b) => {
        if (a.isSelf !== b.isSelf) { return a.isSelf ? -1 : 1; }
        const bySessions = (sessionsPerUser.get(b.id) ?? 0) - (sessionsPerUser.get(a.id) ?? 0);
        if (bySessions !== 0) { return bySessions; }
        return a.name.localeCompare(b.name);
      });

    const now = Date.now();
    return {
      // With no data, collapse the range to a single instant so the client
      // renders an empty track rather than dividing by zero.
      rangeStart: new Date(rangeStart === Infinity ? now : rangeStart).toISOString(),
      rangeEnd: new Date(rangeEnd === -Infinity ? now : rangeEnd).toISOString(),
      users,
      sessions,
      totalSessions: sessions.length,
      totalEvents,
      userCount: users.length,
      signedInSessions,
      signedOutSessions,
    };
  } catch (error) {
    logger.error('Error fetching activity strips', { error });
    throw new Error('Failed to fetch activity statistics');
  }
}
