/**
 * DAL: Get Margin Analysis
 *
 * Returns a full analysis record (including JSON blobs) by agentId + analysisId.
 *
 * Used by: features/ai-agents/routes/margin/get-margin-analysis.ts
 */

import db from '@/server/db';
import type { FlaggedJob, TaskOrderSummary, TmProfitRow } from '@/features/ai-agents/types/margin';

export type MarginAnalysisRecord = {
  id: string;
  filename: string;
  flaggedJobs: FlaggedJob[];
  taskOrderSummaries: TaskOrderSummary[];
  tmProfitRanking: TmProfitRow[];
  analysisAsOf: Date;
  totalJobsAnalyzed: number;
  totalFlaggedJobs: number;
  createdAt: Date;
};

export default async function getMarginAnalysis(
  agentId: string,
  analysisId: string,
): Promise<MarginAnalysisRecord | null> {
  const record = await db.marginAnalysis.findFirst({
    where: { id: analysisId, agentId },
    select: {
      id: true,
      filename: true,
      flaggedJobs: true,
      taskOrderSummaries: true,
      tmProfitRanking: true,
      analysisAsOf: true,
      totalJobsAnalyzed: true,
      totalFlaggedJobs: true,
      createdAt: true,
    },
  });

  if (!record) {
    return null;
  }

  return {
    ...record,
    flaggedJobs: record.flaggedJobs as FlaggedJob[],
    taskOrderSummaries: record.taskOrderSummaries as TaskOrderSummary[],
    tmProfitRanking: record.tmProfitRanking as TmProfitRow[],
  };
}
