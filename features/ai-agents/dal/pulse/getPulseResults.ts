import db from '@/server/db';
import logger from '@/server/logger';
import {
  PulseFieldType,
  type PulseFieldSummary,
  type PulseResult,
  type PulseResultCell,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

function toFieldType(value: string): PulseFieldType {
  return Object.values(PulseFieldType).includes(value as PulseFieldType)
    ? (value as PulseFieldType)
    : PulseFieldType.FREE_TEXT;
}

/**
 * Returns the rows plus the field list, because the table's columns are defined
 * by the job's matrix rather than by a fixed schema. A null agentId reads the job
 * whichever agent owns it, for the worker running its own queued job.
 */
export default async function getPulseResults(
  jobId: string,
  userId: string,
  agentId: string | null,
): Promise<{ results: PulseResult[]; fields: PulseFieldSummary[] }> {
  try {
    const job = await db.agentPulseJob.findFirst({
      where: { id: jobId, userId, ...(agentId === null ? {} : { aiAgentId: agentId }) },
      select: {
        id: true,
        fields: {
          orderBy: { sortOrder: 'asc' },
          select: { fieldName: true, fieldType: true, sortOrder: true },
        },
      },
    });

    if (!job) {
      return { results: [], fields: [] };
    }

    const results = await db.agentPulseResult.findMany({
      where: { jobId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        rowNumber: true,
        responseText: true,
        cells: true,
        sortOrder: true,
        values: {
          select: { fieldName: true, value: true, wasDefaulted: true },
        },
      },
    });

    return {
      fields: job.fields.map((field) => ({
        fieldName: field.fieldName,
        fieldType: toFieldType(field.fieldType),
        sortOrder: field.sortOrder,
      })),
      // cells is a Json column, written only by savePulseResult in this shape.
      results: results.map((result) => ({
        ...result,
        cells: result.cells as unknown as PulseResultCell[] | null,
      })),
    };
  } catch (error) {
    logger.error('Failed to load PULSE results', { jobId, error: (error as Error).message });
    throw new Error('Failed to load PULSE results');
  }
}
