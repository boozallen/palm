import db from '@/server/db';
import logger from '@/server/logger';

type SaveOdramResultParams = {
  jobId: string;
  questionId: number;
  questionName: string;
  teamRating: string;
  independentRating: string;
  overallAssessment: string;
  keyFeedback: string;
  sortOrder: number;
};

export default async function saveOdramResult(params: SaveOdramResultParams): Promise<void> {
  try {
    await db.agentOdramResult.create({
      data: params,
    });
  } catch (error) {
    logger.error('Error saving ODRAM result: ', error);
    throw new Error('Error saving ODRAM result');
  }
}
