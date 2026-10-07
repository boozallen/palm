import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import db from '@/server/db';
import logger from '@/server/logger';
import type {
  PulseExtractedValue,
  PulseResultCell,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

type SavePulseResultParams = {
  jobId: string;
  rowNumber: number;
  responseText: string;
  cells: PulseResultCell[];
  sortOrder: number;
  values: PulseExtractedValue[];
};

/**
 * Persists one processed row. The nested write means a partially-saved row is
 * impossible, which is what makes the worker's resume-by-row-number safe.
 * Storing a row that is already stored is a no-op rather than a failure.
 */
export default async function savePulseResult(params: SavePulseResultParams): Promise<void> {
  try {
    await db.agentPulseResult.create({
      data: {
        jobId: params.jobId,
        rowNumber: params.rowNumber,
        responseText: params.responseText,
        cells: params.cells,
        sortOrder: params.sortOrder,
        values: {
          create: params.values.map((value) => ({
            fieldName: value.fieldName,
            value: value.value,
            wasDefaulted: value.wasDefaulted,
          })),
        },
      },
      select: { id: true },
    });
  } catch (error) {
    // The unique constraint on the row number is the idempotency guard: a
    // redelivered job meeting a row it already stored must resume, not fail the
    // run. A stored row is already a valid one, so it is left as it is.
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.info('PULSE result row was already stored', {
        jobId: params.jobId,
        rowNumber: params.rowNumber,
      });
      return;
    }

    logger.error('Failed to save PULSE result', {
      jobId: params.jobId,
      rowNumber: params.rowNumber,
      error: (error as Error).message,
    });
    throw new Error('Failed to save PULSE result');
  }
}
