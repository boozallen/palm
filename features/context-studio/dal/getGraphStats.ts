import logger from '@/server/logger';
import db from '@/server/db';
import { TimeRange, GraphStats } from '@/features/context-studio/types/context-studio';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';

export default async function getGraphStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
): Promise<GraphStats> {
  try {

    const getUserFilter = (userField: string) => buildUserScopeFilter(userField, userGroupId, userId);

    const [
      graphEntityCountResult,
      graphConceptCountResult,
      graphBuiltCountResult,
    ] = await Promise.all([
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "graph_entity_embeddings" gee
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'gee."createdAt"')}
          ${getUserFilter('gee."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "graph_concept_embeddings" gce
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'gce."createdAt"')}
          ${getUserFilter('gce."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "graph_metadata" gm
        WHERE gm.status = 'Completed'
          ${buildTimeRangeFilter(timeRange, 'gm."completedAt"')}
          ${getUserFilter('gm."userId"')}
      `,
    ]);

    return {
      entities: Number(graphEntityCountResult[0]?.count || 0),
      concepts: Number(graphConceptCountResult[0]?.count || 0),
      graphsBuilt: Number(graphBuiltCountResult[0]?.count || 0),
    };
  } catch (error) {
    logger.error('Error fetching graph stats', { error });
    throw new Error('Failed to fetch graph statistics');
  }
}
