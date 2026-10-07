import db from '@/server/db';
import logger from '@/server/logger';
import type { PulseDistribution } from '@/features/ai-agents/types/pulse/surveyAnalysis';

type DistributionCount = { value: string; count: number; defaultedCount: number };

/**
 * Per-field value counts for the dashboard, for every field the caller names. Values live
 * in their own table precisely so this is one grouped query rather than a scan of every row.
 */
export default async function getPulseValueDistributions(
  jobId: string,
  fieldNames: string[],
): Promise<PulseDistribution[]> {
  if (fieldNames.length === 0) {
    return [];
  }

  try {
    // Grouping on wasDefaulted keeps a fallback countable separately from a real
    // answer, without shrinking the total the percentages are taken against.
    const grouped = await db.agentPulseResultValue.groupBy({
      by: ['fieldName', 'value', 'wasDefaulted'],
      where: { fieldName: { in: fieldNames }, result: { jobId } },
      _count: { _all: true },
    });

    const byField = new Map<string, Map<string, DistributionCount>>();

    grouped.forEach((row) => {
      const values = byField.get(row.fieldName) ?? new Map<string, DistributionCount>();
      const entry = values.get(row.value) ?? { value: row.value, count: 0, defaultedCount: 0 };

      entry.count += row._count._all;

      if (row.wasDefaulted) {
        entry.defaultedCount += row._count._all;
      }

      values.set(row.value, entry);
      byField.set(row.fieldName, values);
    });

    return Array.from(byField.entries()).map(([fieldName, values]) => ({
      fieldName,
      counts: Array.from(values.values()),
    }));
  } catch (error) {
    logger.error('Failed to load PULSE value distributions', {
      jobId,
      error: (error as Error).message,
    });
    throw new Error('Failed to load PULSE value distributions');
  }
}
