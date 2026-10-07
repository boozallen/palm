import logger from '@/server/logger';
import db from '@/server/db';
import { ErrorRecordsQuery, ErrorRecordsQueryResult } from '@/features/shared/types/error-record';
import { Prisma } from '@prisma/client';

export default async function getErrorRecords(
  query: ErrorRecordsQuery,
): Promise<ErrorRecordsQueryResult> {
  try {
    const { source, code, search, page, pageSize } = query;

    const whereClause: Prisma.ErrorRecordWhereInput = {};

    if (source) {
      whereClause.source = source;
    }

    if (code) {
      whereClause.code = code;
    }

    if (search) {
      whereClause.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { route: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [records, totalCount] = await Promise.all([
      db.errorRecord.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.errorRecord.count({
        where: whereClause,
      }),
    ]);

    const results = records.map((record) => ({
      id: record.id,
      userName: record.user?.name ?? null,
      userEmail: record.user?.email ?? null,
      source: record.source,
      route: record.route,
      code: record.code,
      message: record.message,
      stack: record.stack,
      timestamp: record.timestamp,
      metadata: record.metadata as Record<string, unknown> | null,
    }));

    return {
      records: results,
      totalCount,
    };
  } catch (error) {
    logger.error('Failed to fetch error records', error);
    throw new Error('Unable to retrieve error records');
  }
}
