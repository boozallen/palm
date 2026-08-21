import logger from '@/server/logger';
import db from '@/server/db';
import { TimeRange, ChatStats } from '@/features/context-studio/types/context-studio';
import { Prisma } from '@prisma/client';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';

export default async function getChatStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<ChatStats> {
  try {

    const getUserFilter = (userField: string) => buildUserScopeFilter(userField, userGroupId, userId);

    const getAdminFilter = (userField: string) => {
      if (!excludeAdmins) { return Prisma.empty; }
      return Prisma.sql`AND ${Prisma.raw(userField)} NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`;
    };

    const chatStatsResult = await db.$queryRaw<{
      total: bigint;
      withPrompt: bigint;
      withAgent: bigint;
      withUploadedSources: bigint;
      withKnowledgeBaseSources: bigint;
    }[]>`
      SELECT
        COUNT(DISTINCT c.id) as total,
        COUNT(DISTINCT CASE WHEN c."promptId" IS NOT NULL THEN c.id END) as "withPrompt",
        COUNT(DISTINCT CASE WHEN c."agentProviderId" IS NOT NULL THEN c.id END) as "withAgent",
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM "ChatMessage" cm
            JOIN "ChatMessageCitation" cmc ON cm.id = cmc."chatMessageId"
            WHERE cm."chatId" = c.id AND cmc."documentId" IS NOT NULL
          ) THEN c.id
        END) as "withUploadedSources",
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM "ChatMessage" cm
            JOIN "ChatMessageCitation" cmc ON cm.id = cmc."chatMessageId"
            WHERE cm."chatId" = c.id AND cmc."knowledgeBaseId" IS NOT NULL
          ) THEN c.id
        END) as "withKnowledgeBaseSources"
      FROM "Chat" c
      WHERE 1=1
        ${buildTimeRangeFilter(timeRange, 'c."createdAt"')}
        ${getUserFilter('c."userId"')}
        ${getAdminFilter('c."userId"')}
    `;

    return {
      total: Number(chatStatsResult[0]?.total || 0),
      withPrompt: Number(chatStatsResult[0]?.withPrompt || 0),
      withAgent: Number(chatStatsResult[0]?.withAgent || 0),
      withUploadedSources: Number(chatStatsResult[0]?.withUploadedSources || 0),
      withKnowledgeBaseSources: Number(chatStatsResult[0]?.withKnowledgeBaseSources || 0),
    };
  } catch (error) {
    logger.error('Error fetching chat stats', { error });
    throw new Error('Failed to fetch chat statistics');
  }
}
