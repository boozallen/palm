import logger from '@/server/logger';
import db from '@/server/db';
import { Prisma } from '@prisma/client';
import { DocumentSearchQuery, DocumentSearchQueryResult } from '@/features/context-studio/types/chat-search';

export default async function searchDocuments(
  query: DocumentSearchQuery,
): Promise<DocumentSearchQueryResult> {
  try {
    const { search, documentType, startDate, endDate, excludeAdmins, timeRange, userGroupId, userId, page, pageSize } = query;

    const whereClause: Prisma.DocumentWhereInput = {};

    if (timeRange && timeRange !== 'forever') {
      const now = new Date();
      const daysMap = { week: 7, month: 30, year: 365 };
      const daysAgo = new Date(now.getTime() - daysMap[timeRange] * 24 * 60 * 60 * 1000);
      whereClause.createdAt = { ...(whereClause.createdAt as object), gte: daysAgo };
    }

    if (startDate) {
      whereClause.createdAt = { ...(whereClause.createdAt as object), gte: new Date(startDate) };
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      whereClause.createdAt = { ...(whereClause.createdAt as object), lt: end };
    }

    if (userId && userId !== 'all') {
      whereClause.userId = userId;
    } else if (userGroupId && userGroupId !== 'all') {
      whereClause.user = {
        ...whereClause.user as object,
        userGroupMemberhip: { some: { userGroupId } },
      };
    }

    if (excludeAdmins) {
      whereClause.user = { ...whereClause.user as object, role: { not: 'Admin' } };
    }

    if (search) {
      whereClause.filename = { contains: search, mode: 'insensitive' };
    }

    if (documentType) {
      whereClause.dataProfile = {
        path: ['type'],
        equals: documentType,
      };
    }

    const [documents, totalCount] = await Promise.all([
      db.document.findMany({
        where: whereClause,
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.document.count({ where: whereClause }),
    ]);

    const records = documents.map((doc) => {
      const profile = doc.dataProfile as { type?: string; summary?: string } | null;
      return {
        id: doc.id,
        filename: doc.filename,
        userName: doc.user?.name ?? null,
        userEmail: doc.user?.email ?? null,
        createdAt: doc.createdAt,
        type: profile?.type ?? null,
        summary: profile?.summary ?? null,
      };
    });

    return { records, totalCount };
  } catch (error) {
    logger.error('Failed to search documents', error);
    throw new Error('Unable to search documents');
  }
}
