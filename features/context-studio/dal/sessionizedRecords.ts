import { Prisma } from '@prisma/client';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

// The one place the session inactivity gap is defined. A new session is cut
// whenever a user is quiet for longer than this. Built lazily (inside the
// function) rather than at module load so importing this file never evaluates a
// Prisma tagged template — that call fails in the jsdom test environment.
const SESSION_GAP = () => Prisma.sql`interval '30 minutes'`;

// Assigns a per-user session number to every audit record. A new session is cut
// on any of three boundaries, so a session is bookended by the auth events that
// really opened and closed it whenever they exist:
//   1. a sign-in — it always opens a session, however recent the last record was
//   2. the record after a sign-out — a sign-out always closes its session
//   3. an inactivity gap longer than SESSION_GAP, which covers the sessions that
//      simply went quiet (tab closed, token expiry) with no sign-out written
// Without rules 1 and 2 a sign-out followed by a prompt re-login reads as one
// long session with `… › User Sign Out › User Sign In › …` buried mid-path.
//
// Returns a CTE chain ending in `sessionized`, which carries every scoped column
// plus `session_no`; callers append their own SELECT. `filters` are the same
// optional `AND …` fragments each view already builds (time range, user, group,
// exclude admins).
export const sessionizedRecords = (filters: Prisma.Sql) => Prisma.sql`
  WITH scoped AS (
    SELECT ar.id, ar."userId", u.name AS "userName", ar.event, ar.outcome,
           ar.description, ar.referer, ar."timestamp"
    FROM "AuditRecord" ar
    LEFT JOIN "User" u ON u.id = ar."userId"
    WHERE ar."userId" IS NOT NULL
    ${filters}
  ),
  gapped AS (
    SELECT *,
      CASE WHEN LAG("timestamp") OVER user_time IS NULL
        OR "timestamp" - LAG("timestamp") OVER user_time > ${SESSION_GAP()}
        OR event = ${AuditRecordEvent.UserSignIn}
        OR LAG(event) OVER user_time = ${AuditRecordEvent.UserSignOut}
      THEN 1 ELSE 0 END AS is_session_start
    FROM scoped
    WINDOW user_time AS (PARTITION BY "userId" ORDER BY "timestamp")
  ),
  sessionized AS (
    SELECT *,
      SUM(is_session_start) OVER (
        PARTITION BY "userId" ORDER BY "timestamp"
        ROWS UNBOUNDED PRECEDING
      ) AS session_no
    FROM gapped
  )
`;
