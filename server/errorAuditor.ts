import { Prisma } from '@prisma/client';
import db from '@/server/db';
import logger from '@/server/logger';

export interface ErrorAuditorOptions {
  userId?: string | null;
}

export interface ErrorAuditorDetails {
  source: string;
  route?: string | null;
  code: string;
  message: string;
  stack?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class ErrorAuditor {
  private userId: string | null;

  constructor(options: ErrorAuditorOptions) {
    this.userId = options.userId ?? null;
  }

  async createErrorRecord(details: ErrorAuditorDetails): Promise<void> {
    const { metadata, ...rest } = details;

    try {
      await db.errorRecord.create({
        data: {
          userId: this.userId,
          ...rest,
          // Prisma treats a bare `null` on a Json column as ambiguous, so an
          // absent metadata object has to be spelled out as a SQL NULL.
          metadata: metadata ? (metadata as Prisma.InputJsonObject) : Prisma.DbNull,
        },
      });
    } catch (error) {
      logger.error('Error creating Error Record', error);
    }
  }
}

export function createErrorAuditor(options: ErrorAuditorOptions): ErrorAuditor {
  return new ErrorAuditor(options);
}
