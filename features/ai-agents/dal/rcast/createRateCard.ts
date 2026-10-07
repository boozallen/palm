import db from '@/server/db';
import logger from '@/server/logger';
import type { RateCardRow } from '@/features/ai-agents/utils/rcast/parseRateCard';

type CreateRateCardInput = {
  aiAgentId: string;
  userId: string;
  fileName: string;
  parsedRows: RateCardRow[];
  userGroupId: string | null;
};

export default async function createRateCard({
  aiAgentId,
  userId,
  fileName,
  parsedRows,
  userGroupId,
}: CreateRateCardInput) {
  if (!db.rateCard) {
    logger.error('Prisma client missing rateCard model', {
      availableModels: Object.keys(db).filter(
        (k) => typeof (db as any)[k] === 'object'
      ),
    });
    throw new Error(
      'Database schema error: rateCard model not available. Server restart may be required.'
    );
  }

  const rateCard = await db.rateCard.create({
    data: {
      agentId: aiAgentId,
      userId,
      filename: fileName,
      uploadStatus: 'pending',
      userGroupId,
    },
  });

  let successCount = 0;
  let failureCount = 0;

  for (const row of parsedRows) {
    try {
      await db.rateCardCategory.create({
        data: {
          rateCardId: rateCard.id,
          laborCategoryName: row.laborCategory,
          experienceLevel: row.experienceLevel,
          billRate: row.rate,
        },
      });
      successCount++;
    } catch (error) {
      logger.error('Error creating rate card category:', {
        laborCategory: row.laborCategory,
        error,
      });
      failureCount++;
    }
  }

  logger.info('Rate card created', { rateCardId: rateCard.id, successCount, failureCount });

  if (successCount === 0) {
    throw new Error('Failed to create any rate card categories.');
  }

  return { rateCardId: rateCard.id, successCount, failureCount };
}
