import { Prisma } from '@prisma/client';

import logger from '../server/logger';
import db from '../server/db';
import {
  AuditRecord,
  AuditRecordOutcome,
  AuditRecordEvent,
  AuditRecordMetadata,
} from '../features/shared/types/audit-record';

export interface AuditorOptions {
  userId?: string | null;
  referer?: string | null;
}

export interface AuditorDetails {
  outcome: AuditRecordOutcome;
  description: string;
  event: AuditRecordEvent;
  // Optional per-record referer override. Falls back to the context-level
  // referer (the HTTP Referer header) when not provided.
  referer?: string | null;
  // Structured context identifying the resource acted on, so the action can be
  // correlated with a specific artifact, message, or export later on.
  metadata?: AuditRecordMetadata | null;
}

export class Auditor {
  private userId: string | null;
  private referer?: string | null;

  constructor(options: AuditorOptions) {
    this.userId = options.userId ?? null;
    this.referer = options.referer ?? null;
  }

  async createAuditRecord(details: AuditorDetails): Promise<void> {
    const { referer: detailsReferer, ...restDetails } = details;
    const record: AuditRecord = {
      userId: this.userId,
      referer: detailsReferer ?? this.referer,
      ...restDetails,
    };

    logger.info('Event audited', record);

    const { metadata, ...columns } = record;

    try {
      const newAuditRecord = await db.auditRecord.create({
        data: {
          ...columns,
          // Prisma treats a bare `null` on a Json column as ambiguous, so an
          // absent metadata object has to be spelled out as a SQL NULL.
          metadata: metadata ? (metadata as Prisma.InputJsonObject) : Prisma.DbNull,
        },
        select: {
          id: true,
        },
      });
      logger.info(`Successfully created new Audit Record. ID: ${newAuditRecord.id}.`);
    } catch (error) {
      logger.error('Error creating Audit Record', error);
      logger.debug(record);
    }
  }
}

// Factory function to create a new Auditor instance with default options
export function createAuditor(options: AuditorOptions): Auditor {
  return new Auditor(options);
}
