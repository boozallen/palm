import db from '@/server/db';
import logger from '@/server/logger';
import { isJobStatus, type JobStatusType } from '@/features/ai-agents/utils/shared/types';

// A null agentId reads the job whichever agent owns it, for the worker reacting to its own job.
export default async function getPulseJobStatus(
  jobId: string,
  userId: string,
  agentId: string | null,
): Promise<{ status: JobStatusType; errorMessage: string | null } | null> {
  try {
    const job = await db.agentPulseJob.findFirst({
      where: { id: jobId, userId, ...(agentId === null ? {} : { aiAgentId: agentId }) },
      select: { status: true, errorMessage: true },
    });

    if (!job) {
      return null;
    }

    if (!isJobStatus(job.status)) {
      throw new Error(`Unrecognized PULSE job status: ${job.status}`);
    }

    return {
      status: job.status,
      errorMessage: job.errorMessage,
    };
  } catch (error) {
    logger.error('Failed to load PULSE job status', { jobId, error: (error as Error).message });
    throw new Error('Failed to load PULSE job status');
  }
}
