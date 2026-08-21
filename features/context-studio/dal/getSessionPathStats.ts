import logger from '@/server/logger';
import db from '@/server/db';
import {
  SessionPath,
  SessionPathStats,
  TimeRange,
} from '@/features/context-studio/types/context-studio';
import { buildAuditFilters } from '@/features/context-studio/dal/auditFilters';
import { sessionizedRecords } from '@/features/context-studio/dal/sessionizedRecords';
import { collapseConsecutiveRepeats, describeEvent } from '@/features/context-studio/dal/eventLabels';

// Lanes beyond this rank fold into a single faint "Other paths" bucket, so the
// section stays legible no matter how long the tail of one-off journeys is.
const TOP_N_PATHS = 6;
const OTHER_LANE = 'Other paths';

// Steps beyond this fold into a trailing summary step. A single pathological
// session can otherwise stretch every lane's node spacing to nothing.
const MAX_STEPS = 9;

type EventRow = {
  userId: string | null;
  userName: string | null;
  session_no: number;
  event: string;
  description: string | null;
  timestamp: Date;
};

type SessionWalk = {
  userName: string;
  steps: string[];
  startedAt: Date;
  endedAt: Date;
  eventCount: number;
  navigationCount: number;
};

// "HH:MM–HH:MM" in the server's local zone, matching how every other Context
// Studio timestamp renders.
const clockWindow = (start: Date, end: Date): string => {
  const clock = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${clock(start)}–${clock(end)}`;
};

// Groups the sessionized rows into per-session walks. Rows arrive ordered by
// user then timestamp, so a session is a contiguous run sharing a session
// number; the 30-minute gap lives in the shared CTE, not here.
function buildWalks(rows: EventRow[]): SessionWalk[] {
  const walks: SessionWalk[] = [];
  let current: EventRow[] = [];
  let key: string | null = null;

  const flush = () => {
    if (current.length === 0) { return; }
    const described = current.map((row) => describeEvent(row.event, row.description));
    const collapsed = collapseConsecutiveRepeats(described);
    const labels = collapsed.map((step) => step.label);
    const steps = labels.length > MAX_STEPS
      ? [...labels.slice(0, MAX_STEPS), `+${labels.length - MAX_STEPS} more`]
      : labels;

    walks.push({
      userName: current[0].userName ?? 'Unknown user',
      steps,
      startedAt: current[0].timestamp,
      endedAt: current[current.length - 1].timestamp,
      eventCount: current.length,
      navigationCount: described.filter((step) => step.isNavigation).length,
    });
    current = [];
  };

  for (const row of rows) {
    const rowKey = `${row.userId ?? 'anon'}:${row.session_no}`;
    if (rowKey !== key) {
      flush();
      key = rowKey;
    }
    current.push(row);
  }
  flush();

  return walks;
}

// Collapses walks that share an identical ordered step list into one lane,
// ranks lanes by session count, and folds everything past TOP_N_PATHS into a
// single bucket lane.
function rankPaths(walks: SessionWalk[]): SessionPath[] {
  const grouped = new Map<string, SessionWalk[]>();
  for (const walk of walks) {
    // JSON-keyed so a label containing any delimiter can never collide.
    const key = JSON.stringify(walk.steps);
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(walk);
    } else {
      grouped.set(key, [walk]);
    }
  }

  const ranked = Array.from(grouped.entries())
    .map(([key, group]) => ({ key, group }))
    .sort((a, b) => b.group.length - a.group.length || a.key.localeCompare(b.key));

  const paths: SessionPath[] = ranked.slice(0, TOP_N_PATHS).map(({ group }, index) => {
    const sample = group[0];
    return {
      id: `p${index + 1}`,
      count: group.length,
      steps: sample.steps,
      sampleUser: sample.userName,
      window: clockWindow(sample.startedAt, sample.endedAt),
    };
  });

  const tail = ranked.slice(TOP_N_PATHS);
  if (tail.length > 0) {
    const tailSessions = tail.reduce((sum, entry) => sum + entry.group.length, 0);
    // The bucket has no single real path, so its "steps" summarize the tail
    // rather than pretending to be one journey.
    const distinctLabel = `${tail.length} distinct paths`;
    paths.push({
      id: 'other',
      count: tailSessions,
      steps: [OTHER_LANE, distinctLabel],
      sampleUser: '—',
      window: '',
      isOther: true,
    });
  }

  return paths;
}

export default async function getSessionPathStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<SessionPathStats> {
  try {
    const filters = buildAuditFilters(timeRange, userGroupId, userId, excludeAdmins);

    // Every event for an attributable user becomes a step on its session's path.
    const rows = await db.$queryRaw<EventRow[]>`
      ${sessionizedRecords(filters)}
      SELECT "userId", "userName", session_no, event, description, "timestamp"
      FROM sessionized
      ORDER BY "userId", "timestamp" ASC
    `;

    const walks = buildWalks(rows);

    return {
      paths: rankPaths(walks),
      totalSessions: walks.length,
      totalEvents: walks.reduce((sum, w) => sum + w.eventCount, 0),
      totalNavigations: walks.reduce((sum, w) => sum + w.navigationCount, 0),
    };
  } catch (error) {
    logger.error('Error fetching session path stats', { error });
    throw new Error('Failed to fetch session path statistics');
  }
}
