import db from '@/server/db';
import logger from '@/server/logger';

export type PulseJobListItem = {
  id: string;
  status: string;
  surveyFilename: string;
  responseCount: number;
  createdAt: Date;
};

export default async function getPulseJobs(
  agentId: string,
  userId: string,
): Promise<PulseJobListItem[]> {
  try {
    return await db.agentPulseJob.findMany({
      where: { aiAgentId: agentId, userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        surveyFilename: true,
        responseCount: true,
        createdAt: true,
      },
    });
  } catch (error) {
    logger.error('Failed to load PULSE jobs', { agentId, error: (error as Error).message });
    throw new Error('Failed to load PULSE jobs');
  }
}
