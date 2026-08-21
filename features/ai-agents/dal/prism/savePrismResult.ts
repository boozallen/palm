import db from '@/server/db';
import logger from '@/server/logger';

type SavePrismResultParams = {
  jobId: string;
  category: string | null;
  requirement: string;
  complianceStatus: string;
  reasoning: string;
  citations: string | null;
  sortOrder: number;
};

export default async function savePrismResult(params: SavePrismResultParams): Promise<void> {
  try {
    await db.agentPrismResult.create({
      data: params,
    });
  } catch (error) {
    logger.error('Error saving PRISM result: ', error);
    throw new Error('Error saving PRISM result');
  }
}
