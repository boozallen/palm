import logger from '../server/logger';
import db from '../server/db';
import {
  AuditRecord,
  AuditRecordOutcome,
  AuditRecordEvent,
} from '../features/shared/types/audit-record';

export interface AuditorOptions {
  userId?: string | null;
  referer?: string | null;
}

export interface AuditorDetails {
  outcome: AuditRecordOutcome;
  description: string;
  event: AuditRecordEvent;
}

export class Auditor {
  private userId: string | null;
  private referer?: string | null;

  constructor(options: AuditorOptions) {
    this.userId = options.userId ?? null;
    this.referer = options.referer ?? null;
  }

  async createAuditRecord(details: AuditorDetails): Promise<void> {
    const record: AuditRecord = {
      userId: this.userId,
      referer: this.referer,
      ...details,
    };

    logger.info('Event audited', record);

    try {
      const newAuditRecord = await db.auditRecord.create({
        data: {
          ...record,
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
