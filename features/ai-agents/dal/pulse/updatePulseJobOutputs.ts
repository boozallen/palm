import { Prisma } from '@prisma/client';

import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import type { PulseResultsOutputs } from '@/features/ai-agents/types/pulse/results';

export type PulseJobOutputsUpdate = {
  outputs: PulseResultsOutputs;
  failedRowCount: number;
  completedAt: Date;
};

export default async function updatePulseJobOutputs(
  jobId: string,
  update: PulseJobOutputsUpdate,
): Promise<void> {
  const { outputs } = update;

  try {
    await db.agentPulseJob.update({
      where: { id: jobId },
      data: {
        resultsProfile: outputs.profile,
        // A nullable Json column needs DbNull; a bare null is rejected by the client.
        resultsNarrative: outputs.narrative ?? Prisma.DbNull,
        resultsDashboardHtml: outputs.dashboardHtml,
        slidesHtml: outputs.slidesHtml,
        executiveSummaryPdf: outputs.executiveSummaryPdf,
        outputErrors: outputs.errors,
        failedRowCount: update.failedRowCount,
        completedAt: update.completedAt,
      },
      select: { id: true },
    });
  } catch (error) {
    logger.error('Failed to save the PULSE results outputs', {
      jobId,
      reason: handlePrismaError(error),
    });
    throw new Error('Failed to save the PULSE results outputs');
  }
}
