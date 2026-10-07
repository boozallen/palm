import logger from '@/server/logger';
import db from '@/server/db';
import {
  AuditRecordsQuery,
  AuditRecordsQueryResult,
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordMetadata,
  auditRecordMetadata,
} from '@/features/shared/types/audit-record';
import { Prisma } from '@prisma/client';

// Metadata is stored as free-form JSON, and older records predate the column
// entirely. Parse defensively so one malformed row can't break the whole page.
function parseMetadata(value: Prisma.JsonValue | null): AuditRecordMetadata | null {
  if (!value) {
    return null;
  }

  const parsed = auditRecordMetadata.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export default async function getAuditRecords(
  query: AuditRecordsQuery,
): Promise<AuditRecordsQueryResult> {
  try {
    const { event, outcome, search, page, pageSize } = query;

    const whereClause: Prisma.AuditRecordWhereInput = {};

    if (event) {
      whereClause.event = event;
    }

    if (outcome) {
      whereClause.outcome = outcome;
    }

    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { event: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [records, totalCount] = await Promise.all([
      db.auditRecord.findMany({
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
      db.auditRecord.count({
        where: whereClause,
      }),
    ]);

    const results = records.map((record) => ({
      id: record.id,
      userName: record.user?.name ?? null,
      userEmail: record.user?.email ?? null,
      event: record.event as AuditRecordEvent,
      outcome: record.outcome as AuditRecordOutcome,
      description: record.description,
      referer: record.referer,
      timestamp: record.timestamp,
      metadata: parseMetadata(record.metadata),
    }));

    return {
      records: results,
      totalCount,
    };
  } catch (error) {
    logger.error('Failed to fetch audit records', error);
    throw new Error('Unable to retrieve audit records');
  }
}
