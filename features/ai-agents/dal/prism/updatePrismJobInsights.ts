import db from '@/server/db';
import logger from '@/server/logger';
import type { ProposalInsights } from '@/features/ai-agents/types/shared/proposalInsights';

export default async function updatePrismJobInsights(jobId: string, insights: ProposalInsights): Promise<void> {
  try {
    await db.agentPrismJob.update({
      where: { id: jobId },
      data: insights,
    });
  } catch (error) {
    logger.error('Error updating PRISM job insights: ', error);
    throw new Error('Error updating PRISM job insights');
  }
}
