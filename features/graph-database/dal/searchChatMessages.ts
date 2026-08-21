import { Prisma } from '@prisma/client';

import {
  CONVERSATION_SEARCH_CANDIDATE_POOL,
  CONVERSATION_SEARCH_MIN_SIMILARITY,
  CONVERSATION_SEARCH_RRF_K,
} from '@/features/graph-database/config/conversation-graph.config';
import db from '@/server/db';
import logger from '@/server/logger';

type SearchChatMessagesInput = {
  userId: string;
  embedding?: number[];
  queryText?: string;
  excludeChatId?: string;
  limit: number;
  offset?: number;
};

export type ChatMessageSearchRow = {
  messageId: string;
  chatId: string;
  chatSummary: string | null;
  role: string;
  text: string;
  createdAt: Date;
  similarity: number | null;
  textRank: number | null;
};

export default async function searchChatMessages({
  userId,
  embedding,
  queryText,
  excludeChatId,
  limit,
  offset = 0,
}: SearchChatMessagesInput): Promise<ChatMessageSearchRow[]> {
  try {
    const hasEmbedding = Boolean(embedding?.length);
    const hasQueryText = Boolean(queryText?.trim());
    if (!hasEmbedding && !hasQueryText) {
      return [];
    }
    if (hasEmbedding && !embedding?.every((value) => (
      typeof value === 'number' && Number.isFinite(value)
    ))) {
      throw new Error('Invalid embedding values');
    }

    const vectorString = hasEmbedding ? `[${embedding?.join(',')}]` : null;
    const messageFilter = Prisma.sql`
      s."userId" = ${userId}::uuid
      AND c."userId" = ${userId}::uuid
      ${excludeChatId ? Prisma.sql`AND c."id" <> ${excludeChatId}::uuid` : Prisma.empty}
    `;
    // Text comes from ChatMessage, the single source of truth — the sidecar stores only
    // derived search data (word list + embedding), never a copy of the message.
    const selectedColumns = Prisma.sql`
      s."messageId", m."chatId", c."summary" AS "chatSummary", m."role",
      m."content" AS "text", m."createdAt"
    `;

    let searchQuery: Prisma.Sql;
    if (vectorString && hasQueryText) {
      searchQuery = Prisma.sql`
        WITH q AS (
          SELECT websearch_to_tsquery('english', ${queryText}) AS tsq
        ),
        -- HNSW applies the tenant filter after its index scan, which can reduce
        -- per-tenant recall. candidateSearchExact.ts documents the exact-scan alternative.
        vector_hits AS (
          SELECT
            s."messageId",
            ROW_NUMBER() OVER (ORDER BY s."embedding" <=> ${vectorString}::vector) AS vrank,
            (1 - (s."embedding" <=> ${vectorString}::vector))::double precision AS "similarity"
          FROM "chat_message_search" s
          JOIN "ChatMessage" m ON m."id" = s."messageId"
          JOIN "Chat" c ON c."id" = m."chatId"
          WHERE ${messageFilter}
            AND s."embedding" IS NOT NULL
            AND (1 - (s."embedding" <=> ${vectorString}::vector))
              >= ${CONVERSATION_SEARCH_MIN_SIMILARITY}
          ORDER BY s."embedding" <=> ${vectorString}::vector
          LIMIT ${CONVERSATION_SEARCH_CANDIDATE_POOL}
        ),
        text_hits AS (
          SELECT
            s."messageId",
            ROW_NUMBER() OVER (
              ORDER BY ts_rank(s."textSearch", q.tsq) DESC
            ) AS trank,
            ts_rank(s."textSearch", q.tsq) AS "textRank"
          FROM "chat_message_search" s
          JOIN "ChatMessage" m ON m."id" = s."messageId"
          JOIN "Chat" c ON c."id" = m."chatId"
          CROSS JOIN q
          WHERE ${messageFilter}
            AND s."textSearch" @@ q.tsq
          ORDER BY ts_rank(s."textSearch", q.tsq) DESC
          LIMIT ${CONVERSATION_SEARCH_CANDIDATE_POOL}
        )
        SELECT
          ${selectedColumns}, v."similarity", t."textRank"
        FROM vector_hits v
        FULL OUTER JOIN text_hits t ON t."messageId" = v."messageId"
        JOIN "chat_message_search" s
          ON s."messageId" = COALESCE(v."messageId", t."messageId")
        JOIN "ChatMessage" m ON m."id" = s."messageId"
        JOIN "Chat" c ON c."id" = m."chatId"
        ORDER BY
          COALESCE(1.0 / (${CONVERSATION_SEARCH_RRF_K} + v.vrank), 0)
          + COALESCE(1.0 / (${CONVERSATION_SEARCH_RRF_K} + t.trank), 0) DESC,
          m."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (vectorString) {
      searchQuery = Prisma.sql`
        WITH
        -- HNSW applies the tenant filter after its index scan, which can reduce
        -- per-tenant recall. candidateSearchExact.ts documents the exact-scan alternative.
        vector_hits AS (
          SELECT
            s."messageId",
            ROW_NUMBER() OVER (ORDER BY s."embedding" <=> ${vectorString}::vector) AS vrank,
            (1 - (s."embedding" <=> ${vectorString}::vector))::double precision AS "similarity"
          FROM "chat_message_search" s
          JOIN "ChatMessage" m ON m."id" = s."messageId"
          JOIN "Chat" c ON c."id" = m."chatId"
          WHERE ${messageFilter}
            AND s."embedding" IS NOT NULL
            AND (1 - (s."embedding" <=> ${vectorString}::vector))
              >= ${CONVERSATION_SEARCH_MIN_SIMILARITY}
          ORDER BY s."embedding" <=> ${vectorString}::vector
          LIMIT ${CONVERSATION_SEARCH_CANDIDATE_POOL}
        )
        SELECT
          ${selectedColumns}, v."similarity", NULL::real AS "textRank"
        FROM vector_hits v
        JOIN "chat_message_search" s ON s."messageId" = v."messageId"
        JOIN "ChatMessage" m ON m."id" = s."messageId"
        JOIN "Chat" c ON c."id" = m."chatId"
        ORDER BY v.vrank
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      searchQuery = Prisma.sql`
        WITH q AS (
          SELECT websearch_to_tsquery('english', ${queryText ?? ''}) AS tsq
        ),
        text_hits AS (
          SELECT
            s."messageId",
            ROW_NUMBER() OVER (
              ORDER BY ts_rank(s."textSearch", q.tsq) DESC
            ) AS trank,
            ts_rank(s."textSearch", q.tsq) AS "textRank"
          FROM "chat_message_search" s
          JOIN "ChatMessage" m ON m."id" = s."messageId"
          JOIN "Chat" c ON c."id" = m."chatId"
          CROSS JOIN q
          WHERE ${messageFilter}
            AND s."textSearch" @@ q.tsq
          ORDER BY ts_rank(s."textSearch", q.tsq) DESC
          LIMIT ${CONVERSATION_SEARCH_CANDIDATE_POOL}
        )
        SELECT
          ${selectedColumns}, NULL::double precision AS "similarity", t."textRank"
        FROM text_hits t
        JOIN "chat_message_search" s ON s."messageId" = t."messageId"
        JOIN "ChatMessage" m ON m."id" = s."messageId"
        JOIN "Chat" c ON c."id" = m."chatId"
        ORDER BY t.trank
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const rows = await db.$queryRaw<ChatMessageSearchRow[]>(searchQuery);
    // SQL enforces the vector floor before pagination; repeat the same invariant at the
    // DAL boundary so callers cannot receive weak vector-only rows.
    const filteredRows = rows.filter((row) => (
      row.similarity === null
      || row.similarity >= CONVERSATION_SEARCH_MIN_SIMILARITY
      || (row.textRank ?? 0) > 0
    ));
    if (filteredRows.length < rows.length) {
      logger.info('Conversation message search relevance floor dropped rows', {
        userId,
        beforeCount: rows.length,
        afterCount: filteredRows.length,
        threshold: CONVERSATION_SEARCH_MIN_SIMILARITY,
      });
    }

    return filteredRows;
  } catch (error) {
    logger.error('Error searching chat messages', { userId, error });
    throw new Error('Error searching chat messages');
  }
}
