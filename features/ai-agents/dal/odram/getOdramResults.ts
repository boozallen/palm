import db from '@/server/db';
import logger from '@/server/logger';

export default async function getOdramResults(jobId: string) {
  try {
    const job = await db.agentOdramJob.findUnique({
      where: { id: jobId },
      select: { summary: true },
    });

    const results = await db.agentOdramResult.findMany({
      where: { jobId },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      summary: job?.summary ?? null,
      results,
    };
  } catch (error) {
    logger.error('Error fetching ODRAM results: ', error);
    throw new Error('Error fetching ODRAM results');
  }
}
