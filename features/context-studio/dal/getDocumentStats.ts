import logger from '@/server/logger';
import db from '@/server/db';
import { TimeRange, DocumentStats } from '@/features/context-studio/types/context-studio';
import { Prisma } from '@prisma/client';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';

export default async function getDocumentStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<DocumentStats> {
  try {

    const getUserFilter = (userField: string) => buildUserScopeFilter(userField, userGroupId, userId);

    const getAdminFilter = (userField: string) => {
      if (!excludeAdmins) { return Prisma.empty; }
      return Prisma.sql`AND ${Prisma.raw(userField)} NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`;
    };

    const [
      documentCountResult,
      sharedDocumentCountResult,
      acceptedDocumentCountResult,
      rejectedDocumentCountResult,
      embeddingCountResult,
    ] = await Promise.all([
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Document" d
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'd."createdAt"')}
          ${getUserFilter('d."userId"')}
          ${getAdminFilter('d."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "shared_documents" sd
        WHERE sd."deletedAt" IS NULL
          ${buildTimeRangeFilter(timeRange, 'sd."createdAt"')}
          ${getUserFilter('sd."sourceUserId"')}
          ${getAdminFilter('sd."sourceUserId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "shared_document_actions" sda
        WHERE sda.status = 'accepted'
          ${buildTimeRangeFilter(timeRange, 'sda."createdAt"')}
          ${getUserFilter('sda."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "shared_document_actions" sda
        WHERE sda.status = 'rejected'
          ${buildTimeRangeFilter(timeRange, 'sda."createdAt"')}
          ${getUserFilter('sda."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Embedding" e
        JOIN "Document" d ON e."documentId" = d.id
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'e."createdAt"')}
          ${getUserFilter('d."userId"')}
          ${getAdminFilter('d."userId"')}
      `,
    ]);

    return {
      total: Number(documentCountResult[0]?.count || 0),
      shared: Number(sharedDocumentCountResult[0]?.count || 0),
      accepted: Number(acceptedDocumentCountResult[0]?.count || 0),
      rejected: Number(rejectedDocumentCountResult[0]?.count || 0),
      embeddings: {
        total: Number(embeddingCountResult[0]?.count || 0),
      },
    };
  } catch (error) {
    logger.error('Error fetching document stats', { error });
    throw new Error('Failed to fetch document statistics');
  }
}
