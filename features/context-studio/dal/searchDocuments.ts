import logger from '@/server/logger';
import db from '@/server/db';
import { Prisma } from '@prisma/client';
import { DocumentSearchQuery, DocumentSearchQueryResult } from '@/features/context-studio/types/chat-search';
import { getFileExtension } from '@/features/shared/types/document';

export default async function searchDocuments(
  query: DocumentSearchQuery,
): Promise<DocumentSearchQueryResult> {
  try {
    const { search, documentType, fileType, startDate, endDate, excludeAdmins, timeRange, userGroupId, userId, page, pageSize } = query;

    // Built without `fileType` so the breakdown query below can report every
    // type available under the other filters, not just the currently selected one.
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

    const paginatedWhereClause: Prisma.DocumentWhereInput = fileType
      ? { ...whereClause, filename: { ...(whereClause.filename as object), endsWith: fileType, mode: 'insensitive' } }
      : whereClause;

    const [documents, totalCount, typeCountRows] = await Promise.all([
      db.document.findMany({
        where: paginatedWhereClause,
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.document.count({ where: paginatedWhereClause }),
      // Lightweight — filenames only — so the type-filter dropdown's counts
      // cover the whole matching set rather than just the current page.
      db.document.findMany({ where: whereClause, select: { filename: true } }),
    ]);

    const typeCounts: Record<string, number> = {};
    for (const doc of typeCountRows) {
      const ext = getFileExtension(doc.filename);
      typeCounts[ext] = (typeCounts[ext] ?? 0) + 1;
    }

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

    return { records, totalCount, typeCounts };
  } catch (error) {
    logger.error('Failed to search documents', error);
    throw new Error('Unable to search documents');
  }
}
