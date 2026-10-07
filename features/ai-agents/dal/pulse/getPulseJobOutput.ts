import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import type { PulseOutputKind } from '@/features/ai-agents/types/pulse/results';

// Null when the run is not the user's, not this agent's, or that output was not stored.
export default async function getPulseJobOutput(
  jobId: string,
  userId: string,
  agentId: string,
  kind: PulseOutputKind,
): Promise<string | Buffer | null> {
  try {
    // Selects only the requested body, since the other two can each be megabytes.
    const job = await db.agentPulseJob.findFirst({
      where: { id: jobId, aiAgentId: agentId, userId },
      select: {
        resultsDashboardHtml: kind === 'dashboard',
        slidesHtml: kind === 'slides',
        executiveSummaryPdf: kind === 'pdf',
      },
    });

    if (!job) {
      return null;
    }

    if (kind === 'pdf') {
      return job.executiveSummaryPdf ? Buffer.from(job.executiveSummaryPdf) : null;
    }

    if (kind === 'slides') {
      return job.slidesHtml ?? null;
    }

    return job.resultsDashboardHtml ?? null;
  } catch (error) {
    logger.error('Failed to load the PULSE results output', {
      jobId,
      kind,
      reason: handlePrismaError(error),
    });
    throw new Error('Failed to load the PULSE results output');
  }
}
