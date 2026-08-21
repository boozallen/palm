/**
 * DAL: Create Margin Analysis
 *
 * Persists a completed MARGIN analysis run to the database.
 *
 * Used by: features/ai-agents/routes/margin/upload-financials.ts
 */

import db from '@/server/db';
import logger from '@/server/logger';
import type { MarginAnalysisResult } from '@/features/ai-agents/types/margin';

type CreateMarginAnalysisInput = {
  agentId: string;
  userId: string;
  filename: string;
  result: MarginAnalysisResult;
};

export default async function createMarginAnalysis({
  agentId,
  userId,
  filename,
  result,
}: CreateMarginAnalysisInput): Promise<{ analysisId: string }> {
  const record = await db.marginAnalysis.create({
    data: {
      agentId,
      userId,
      filename,
      flaggedJobs: result.flaggedJobs,
      taskOrderSummaries: result.taskOrderSummaries,
      tmProfitRanking: result.tmProfitRanking,
      analysisAsOf: new Date(result.analysisAsOf),
      totalJobsAnalyzed: result.totalJobsAnalyzed,
      totalFlaggedJobs: result.totalFlaggedJobs,
    },
    select: { id: true },
  });

  logger.info('Margin analysis created', { analysisId: record.id, agentId });

  return { analysisId: record.id };
}
