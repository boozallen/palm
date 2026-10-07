import { createErrorAuditor } from '@/server/errorAuditor';
import extractProposalInsights, {
  type InsightsCompletionAdapter,
} from '@/features/ai-agents/utils/shared/extractProposalInsights';
import type { ProposalInsights } from '@/features/ai-agents/types/shared/proposalInsights';

export const INSIGHTS_EXTRACTION_FAILED_CODE = 'PROPOSAL_INSIGHTS_EXTRACTION_FAILED';
export const INSIGHTS_SAVE_FAILED_CODE = 'PROPOSAL_INSIGHTS_SAVE_FAILED';

type CaptureProposalInsightsParams = {
  jobId: string;
  userId: string;
  queueName: string;
  text: string;
  completionAdapter: InsightsCompletionAdapter;
  saveInsights: (jobId: string, insights: ProposalInsights) => Promise<void>;
};

export default async function captureProposalInsights({
  jobId,
  userId,
  queueName,
  text,
  completionAdapter,
  saveInsights,
}: CaptureProposalInsightsParams): Promise<void> {
  const auditFailure = (code: string, error: unknown) => createErrorAuditor({ userId }).createErrorRecord({
    source: 'background-job',
    route: queueName,
    code,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack ?? null : null,
    metadata: { jobId },
  });

  let insights: ProposalInsights | null;
  try {
    insights = await extractProposalInsights(text, completionAdapter);
  } catch (error) {
    await auditFailure(INSIGHTS_EXTRACTION_FAILED_CODE, error);
    return;
  }

  if (!insights) {
    await auditFailure(INSIGHTS_EXTRACTION_FAILED_CODE, 'Proposal details could not be extracted');
    return;
  }

  if (Object.values(insights).every((value) => value === null)) {
    return;
  }

  try {
    await saveInsights(jobId, insights);
  } catch (error) {
    await auditFailure(INSIGHTS_SAVE_FAILED_CODE, error);
  }
}
