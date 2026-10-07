import logger from '@/server/logger';
import db from '@/server/db';
import { TimeRange, KnowledgeBaseStats } from '@/features/context-studio/types/context-studio';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';

export default async function getKnowledgeBaseStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
): Promise<KnowledgeBaseStats> {
  try {

    const getUserFilter = () => buildUserScopeFilter('kbu."B"', userGroupId, userId);

    const knowledgeBaseCountResult = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT kb.id) as count
      FROM "KnowledgeBase" kb
      JOIN "_KnowledgeBaseToUser" kbu ON kb.id = kbu."A"
      WHERE kb."deletedAt" IS NULL
        ${buildTimeRangeFilter(timeRange, 'kb."createdAt"')}
        ${getUserFilter()}
    `;
    const knowledgeBaseCount = Number(knowledgeBaseCountResult[0]?.count || 0);

    return {
      total: knowledgeBaseCount,
    };
  } catch (error) {
    logger.error('Error fetching knowledge base stats', { error });
    throw new Error('Failed to fetch knowledge base statistics');
  }
}
