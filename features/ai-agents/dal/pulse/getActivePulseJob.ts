import db from '@/server/db';
import logger from '@/server/logger';
import { ACTIVE_JOB_STATUSES, type ActiveJobStatus } from '@/features/ai-agents/utils/shared/types';

export default async function getActivePulseJob(
  agentId: string,
  userId: string,
): Promise<{ id: string; status: ActiveJobStatus } | null> {
  try {
    const job = await db.agentPulseJob.findFirst({
      where: {
        aiAgentId: agentId,
        userId,
        status: { in: [...ACTIVE_JOB_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });

    if (!job) {
      return null;
    }

    // Narrowed on the filter above rather than checked again: the query cannot return another status.
    return { id: job.id, status: job.status as ActiveJobStatus };
  } catch (error) {
    logger.error('Failed to load active PULSE job', {
      agentId,
      error: (error as Error).message,
    });
    throw new Error('Failed to load active PULSE job');
  }
}
