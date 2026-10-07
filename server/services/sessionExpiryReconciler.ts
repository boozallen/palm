import db from '@/server/db';
import logger from '@/server/logger';
import { createAuditor } from '@/server/auditor';
import { wasRecentlyActive } from '@/server/services/sessionLastSeen';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import { UserRoleIdleTimeMS } from '@/features/shared/types/user';

type ExpiredSession = {
  userId: string;
  userName: string;
  lastEventAt: Date;
};

// The reconcile cadence and its outlier margin, fixed together on purpose: the
// SQL scan window below is derived from these, so retuning the tick without
// also reconsidering the margin would silently narrow (or widen) that window.
enum ReconcileIntervalMinutes {
  Tick = 5,
  // Twice the tick: covers a run that started late by up to one full interval
  // (event-loop lag, a slow query) without widening the scan more than needed.
  // An outage longer than this needs a one-time backfill, not a wider window.
  OutlierMargin = 10,
}

// A buffer on top of the client idle-logout window (features/shared/types/user.ts)
// so a session that is still legitimately mid-timeout on the client — warning
// modal showing, or its signOut() call in flight — is never closed out from
// under it before that real UserSignOut record has a chance to land.
const GRACE_MS = 5 * 60 * 1000;
export const SESSION_TIMEOUT_MS = UserRoleIdleTimeMS.User + GRACE_MS;

// How far back the SQL below looks for candidates. Must exceed SESSION_TIMEOUT_MS
// (otherwise nothing could ever match) by enough margin that a run starting up
// to one tick late never misses a session that just crossed the cutoff — see
// ReconcileIntervalMinutes.OutlierMargin. Bounding this keeps the query's cost
// tied to recent activity instead of the full, ever-growing audit log.
const SCAN_WINDOW_MS = SESSION_TIMEOUT_MS + ReconcileIntervalMinutes.OutlierMargin * 60 * 1000;

type ReconcilerState = { running: boolean; timer: NodeJS.Timeout | null };
const g = globalThis as typeof globalThis & { __sessionExpiryReconciler?: ReconcilerState };
if (!g.__sessionExpiryReconciler) {
  g.__sessionExpiryReconciler = { running: false, timer: null };
}
const state = g.__sessionExpiryReconciler;

export function isRunning(): boolean {
  return state.running;
}

/**
 * A session that ends via the client idle-logout (IdleLogoutWrap) already gets
 * a real UserSignOut audit record through NextAuth's signOut() call. This
 * backstops the cases where that call never runs — tab closed, browser crash,
 * laptop asleep — which otherwise leave a session's last audit row stuck as
 * something other than UserSignOut forever, shown by the Context Studio
 * activity feed as "Still open" with no way to ever resolve.
 *
 * Finds each user's most recent audit record, and — only if it is older than
 * the max possible session lifetime — writes a UserSessionExpired record so the
 * session closes out. Deliberately a distinct event from UserSignOut: this is
 * the system inferring a session died, not an explicit sign-out having happened.
 * Idempotent: the synthetic record becomes that user's new last event, so a
 * later run finds nothing left to do for them.
 *
 * An old audit record alone isn't proof a session died: plain chat use — typing,
 * reading — writes no audit record at all, so a user can be genuinely active for
 * far longer than the idle window without one. Each candidate is cross-checked
 * against sessionLastSeen (touched on every tRPC request, audited or not) before
 * being closed out, so only a session with no real traffic either way gets marked
 * expired.
 */
export async function reconcileExpiredSessions(): Promise<number> {
  if (state.running) { return 0; }
  state.running = true;

  try {
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);
    const scanFrom = new Date(Date.now() - SCAN_WINDOW_MS);

    const candidates = await db.$queryRaw<ExpiredSession[]>`
      WITH last_events AS (
        SELECT DISTINCT ON (ar."userId")
          ar."userId", u.name AS "userName", ar.event, ar."timestamp" AS "lastEventAt"
        FROM "AuditRecord" ar
        JOIN "User" u ON u.id = ar."userId"
        WHERE ar."userId" IS NOT NULL
          AND ar."timestamp" > ${scanFrom}
        ORDER BY ar."userId", ar."timestamp" DESC
      )
      SELECT "userId", "userName", "lastEventAt"
      FROM last_events
      WHERE event NOT IN (${AuditRecordEvent.UserSignOut}, ${AuditRecordEvent.UserSessionExpired})
        AND "lastEventAt" < ${cutoff}
    `;

    let closedCount = 0;
    for (const candidate of candidates) {
      if (await wasRecentlyActive(candidate.userId)) {
        continue;
      }

      await createAuditor({ userId: candidate.userId }).createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User session expired: ${candidate.userName}`,
        event: AuditRecordEvent.UserSessionExpired,
        // Backdated to when the idle window actually elapsed, not to when this
        // run happened to fire, so the activity feed shows a realistic session
        // length instead of one inflated by the reconcile interval.
        timestamp: new Date(candidate.lastEventAt.getTime() + UserRoleIdleTimeMS.User),
      });
      closedCount += 1;
    }

    if (closedCount > 0) {
      logger.info(`[session-expiry-reconciler] Closed ${closedCount} expired session(s)`);
    }

    return closedCount;
  } finally {
    state.running = false;
  }
}

// Not parameterized on purpose: SCAN_WINDOW_MS is derived from
// ReconcileIntervalMinutes.Tick, so a caller-supplied interval could silently
// widen the gap between runs beyond what the scan window still covers.
export function startSessionExpiryReconciler(): void {
  if (state.timer) { return; }

  void reconcileExpiredSessions();
  state.timer = setInterval(() => {
    void reconcileExpiredSessions();
  }, ReconcileIntervalMinutes.Tick * 60_000);
  logger.info('[session-expiry-reconciler] periodic reconcile started', { intervalMinutes: ReconcileIntervalMinutes.Tick });
}

export function __resetForTests(): void {
  state.running = false;
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}
