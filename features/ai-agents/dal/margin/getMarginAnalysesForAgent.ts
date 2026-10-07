/**
 * DAL: Get Margin Analyses for Agent
 *
 * Returns summary list of past analyses — no JSON blobs.
 *
 * Used by: features/ai-agents/routes/margin/get-margin-analyses.ts
 */

import db from '@/server/db';

export type MarginAnalysisSummary = {
  id: string;
  filename: string;
  analysisAsOf: Date;
  totalFlaggedJobs: number;
  createdAt: Date;
};

export default async function getMarginAnalysesForAgent(
  agentId: string,
): Promise<MarginAnalysisSummary[]> {
  return db.marginAnalysis.findMany({
    where: { agentId },
    select: {
      id: true,
      filename: true,
      analysisAsOf: true,
      totalFlaggedJobs: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
