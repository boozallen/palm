import db from '@/server/db';
import logger from '@/server/logger';
import { type JobStatusType } from '@/features/ai-agents/utils/shared/types';

export default async function updatePulseJobStatus(
  jobId: string,
  status: JobStatusType,
  errorMessage: string | null = null,
): Promise<void> {
  try {
    await db.agentPulseJob.update({
      where: { id: jobId },
      data: { status, errorMessage },
      select: { id: true },
    });
  } catch (error) {
    logger.error('Failed to update PULSE job status', {
      jobId,
      status,
      error: (error as Error).message,
    });
    throw new Error('Failed to update PULSE job status');
  }
}
