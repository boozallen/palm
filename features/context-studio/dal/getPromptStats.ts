import logger from '@/server/logger';
import db from '@/server/db';
import { TimeRange, PromptStats } from '@/features/context-studio/types/context-studio';
import { Prisma } from '@prisma/client';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';

export default async function getPromptStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<PromptStats> {
  try {

    const getUserFilter = (userField: string) => buildUserScopeFilter(userField, userGroupId, userId);

    const getAdminFilter = (userField: string) => {
      if (!excludeAdmins) { return Prisma.empty; }
      return Prisma.sql`AND ${Prisma.raw(userField)} NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`;
    };

    const [
      userGroupResult,
      userResult,
      libraryPromptCreatedCountResult,
      workflowPromptCreatedCountResult,
      promptGeneratedCountResult,
      libraryPromptChattedCountResult,
      llmCallCountResult,
      llmCallsBySourceResult,
      libraryPromptBookmarkedCountResult,
      libraryPromptUniqueTagsResult,
      libraryPromptsByTagResult,
    ] = await Promise.all([
      userGroupId !== 'all'
        ? db.userGroup.findUnique({ where: { id: userGroupId }, select: { label: true } })
        : Promise.resolve(null),
      userId !== 'all'
        ? db.user.findUnique({ where: { id: userId }, select: { name: true } })
        : Promise.resolve(null),
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Prompt" p
        WHERE p.workflows = false
          ${buildTimeRangeFilter(timeRange, 'p."createdAt"')}
          ${getUserFilter('p."creatorId"')}
          ${getAdminFilter('p."creatorId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Prompt" p
        WHERE p.workflows = true
          ${buildTimeRangeFilter(timeRange, 'p."createdAt"')}
          ${getUserFilter('p."creatorId"')}
          ${getAdminFilter('p."creatorId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "LogEntry" le
        WHERE le.source = 'Prompt Generator'
          ${buildTimeRangeFilter(timeRange, 'le."timestamp"')}
          ${getUserFilter('le."userId"')}
          ${getAdminFilter('le."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT c.id) as count
        FROM "Chat" c
        JOIN "Prompt" p ON c."promptId" = p.id
        WHERE c."promptId" IS NOT NULL AND p.workflows = false
          ${buildTimeRangeFilter(timeRange, 'c."createdAt"')}
          ${getUserFilter('c."userId"')}
          ${getAdminFilter('c."userId"')}
      `,
      // Every LogEntry is one LLM call from any surface. The table has no
      // promptId or workflowId, so this total cannot be attributed to a library
      // prompt or a workflow; it is reported as an app-wide LLM call count.
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "LogEntry" le
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'le."timestamp"')}
          ${getUserFilter('le."userId"')}
          ${getAdminFilter('le."userId"')}
      `,
      db.$queryRaw<{ source: string; method: string; model: string; count: bigint }[]>`
        SELECT
          le.source,
          le.method,
          COALESCE(le.config->>'model', 'Unknown') as model,
          COUNT(*) as count
        FROM "LogEntry" le
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'le."timestamp"')}
          ${getUserFilter('le."userId"')}
          ${getAdminFilter('le."userId"')}
        GROUP BY le.source, le.method, le.config->>'model'
        ORDER BY count DESC
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "PromptBookmark" pb
        JOIN "Prompt" p ON pb."promptId" = p.id
        WHERE p.workflows = false
          ${getUserFilter('pb."userId"')}
          ${getAdminFilter('pb."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT pt.tag) as count
        FROM "PromptTag" pt
        JOIN "Prompt" p ON pt."promptId" = p.id
        WHERE p.workflows = false
          ${buildTimeRangeFilter(timeRange, 'p."createdAt"')}
          ${getUserFilter('p."creatorId"')}
          ${getAdminFilter('p."creatorId"')}
      `,
      db.$queryRaw<{ tag: string; count: bigint }[]>`
        SELECT pt.tag, COUNT(*) as count
        FROM "PromptTag" pt
        JOIN "Prompt" p ON pt."promptId" = p.id
        WHERE p.workflows = false
          ${buildTimeRangeFilter(timeRange, 'p."createdAt"')}
          ${getUserFilter('p."creatorId"')}
          ${getAdminFilter('p."creatorId"')}
        GROUP BY pt.tag
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    const userGroupLabel = userGroupResult?.label;
    const userName = userResult?.name;
    const libraryPromptCreatedCount = Number(libraryPromptCreatedCountResult[0]?.count || 0);
    const workflowPromptCreatedCount = Number(workflowPromptCreatedCountResult[0]?.count || 0);
    const promptGeneratedCount = Number(promptGeneratedCountResult[0]?.count || 0);
    const libraryPromptChattedCount = Number(libraryPromptChattedCountResult[0]?.count || 0);
    const llmCallCount = Number(llmCallCountResult[0]?.count || 0);
    const libraryPromptBookmarkedCount = Number(libraryPromptBookmarkedCountResult[0]?.count || 0);
    const libraryPromptUniqueTagsCount = Number(libraryPromptUniqueTagsResult[0]?.count || 0);

    const llmCallsBySource = llmCallsBySourceResult.map((row) => ({
      source: row.source,
      method: row.method,
      model: row.model,
      count: Number(row.count),
    }));

    const libraryPromptsByTag = libraryPromptsByTagResult.map((row) => ({
      tag: row.tag,
      count: Number(row.count),
    }));

    const libraryPromptTaglessCountResult = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Prompt" p
      WHERE p.workflows = false
        AND NOT EXISTS (
          SELECT 1 FROM "PromptTag" pt WHERE pt."promptId" = p.id
        )
        ${buildTimeRangeFilter(timeRange, 'p."createdAt"')}
        ${getUserFilter('p."creatorId"')}
        ${getAdminFilter('p."creatorId"')}
    `;
    const libraryPromptTaglessCount = Number(libraryPromptTaglessCountResult[0]?.count || 0);

    return {
      timeRange,
      userGroupLabel,
      userName,
      library: {
        created: libraryPromptCreatedCount,
        chatted: libraryPromptChattedCount,
        bookmarked: libraryPromptBookmarkedCount,
        uniqueTags: libraryPromptUniqueTagsCount,
        byTag: libraryPromptsByTag,
        tagless: libraryPromptTaglessCount,
      },
      workflow: {
        created: workflowPromptCreatedCount,
      },
      generated: promptGeneratedCount,
      llmCalls: llmCallCount,
      llmCallsBySource,
    };
  } catch (error) {
    logger.error('Error fetching prompt stats', { error });
    throw new Error('Failed to fetch prompt statistics');
  }
}
