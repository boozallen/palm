import { Prisma } from '@prisma/client';

import { SESSION_GAP } from '@/features/context-studio/dal/sessionizedRecords';
import { ChatSessionLength } from '@/features/context-studio/types/chat-search';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';
import db from '@/server/db';
import logger from '@/server/logger';

type SessionVisitRow = {
  chatId: string;
  totalDurationMs: bigint;
  visits: { enteredAt: string; leftAt: string; durationMs: number }[];
};

// A visit is one Navigation-into-a-chat event, closed by whatever comes next for
// that user — another Navigation, a sign-out, an expiry, or the same inactivity
// gap that ends a session elsewhere in Context Studio.
export default async function buildChatVisitDurations(
  chatIds: string[],
  ownerUserIds: string[],
): Promise<Map<string, ChatSessionLength>> {
  const result = new Map<string, ChatSessionLength>();

  if (chatIds.length === 0 || ownerUserIds.length === 0) {
    return result;
  }

  try {
    const rows = await db.$queryRaw<SessionVisitRow[]>`
      WITH page_events AS (
        SELECT ar."userId", ar."timestamp",
          -- href is always the last "(...)" in the description, so anchor on
          -- the end of the string rather than stopping at the label's first
          -- "(" — a chat summary like "Analysis (Q2)" would otherwise be
          -- mistaken for the href and drop the row from session-time totals.
          substring(ar.description from '\\((/[^)]+)\\)[^(]*$') AS href
        FROM "AuditRecord" ar
        WHERE ar."userId" IN (${Prisma.join(ownerUserIds.map((id) => Prisma.sql`${id}::uuid`))})
          AND ar.event IN (${AuditRecordEvent.Navigation}, ${AuditRecordEvent.UserSignOut}, ${AuditRecordEvent.UserSessionExpired})
      ),
      with_next AS (
        SELECT *,
          LEAD("timestamp") OVER (PARTITION BY "userId" ORDER BY "timestamp") AS next_timestamp
        FROM page_events
      ),
      chat_visits AS (
        SELECT
          substring(href from '^/chat/([0-9a-f-]{36})') AS "chatId",
          "timestamp" AS entered_at,
          COALESCE(next_timestamp, "timestamp" + ${SESSION_GAP()}) AS left_at
        FROM with_next
        WHERE href IS NOT NULL
      )
      SELECT
        "chatId",
        SUM(EXTRACT(EPOCH FROM (left_at - entered_at)) * 1000)::bigint AS "totalDurationMs",
        jsonb_agg(
          jsonb_build_object(
            'enteredAt', entered_at,
            'leftAt', left_at,
            'durationMs', EXTRACT(EPOCH FROM (left_at - entered_at)) * 1000
          ) ORDER BY entered_at
        ) AS visits
      FROM chat_visits
      WHERE "chatId" IS NOT NULL AND "chatId" IN (${Prisma.join(chatIds)})
      GROUP BY "chatId"
    `;

    rows.forEach((row) => {
      result.set(row.chatId, {
        totalDurationMs: Number(row.totalDurationMs),
        visits: row.visits.map((visit) => ({
          enteredAt: new Date(visit.enteredAt),
          leftAt: new Date(visit.leftAt),
          durationMs: Math.round(visit.durationMs),
        })),
      });
    });

    return result;
  } catch (error) {
    logger.error('Failed to load chat visit durations', { error });
    throw new Error('Failed to fetch chat visit durations');
  }
}
