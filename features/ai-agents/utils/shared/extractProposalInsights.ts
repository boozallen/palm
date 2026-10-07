import { z } from 'zod';

import logger from '@/server/logger';
import { PROPOSAL_INSIGHTS_PROMPT } from '@/features/ai-agents/data/shared/prompts';
import type { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { fenceData } from '@/features/ai-agents/utils/pulse/worker/dataFence';
import { parseJsonObject } from '@/features/ai-agents/utils/shared/parseJsonObject';
import type { ParsedRequirement } from '@/features/ai-agents/types/prism/complianceResult';
import type { ProposalInsights } from '@/features/ai-agents/types/shared/proposalInsights';

export const PRISM_PROPOSAL_CHARS = 24000;
export const PRISM_REQUIREMENTS_CHARS = 6000;
export const ODRAM_PER_DOCUMENT_CHARS = 10000;
export const ODRAM_TOTAL_CHARS = 30000;

const MAX_ATTEMPTS = 2;
const PLACEHOLDER_VALUES = new Set(['null', 'n/a', 'na', 'none', 'unknown', 'not stated', 'not specified', 'not provided']);

export type InsightsCompletionAdapter = Pick<AiFactoryCompletionAdapter, 'complete'>;

const insightField = z.union([z.string(), z.number(), z.null()]).optional().transform((value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const stringValue = typeof value === 'number' ? value.toString() : value;
  const trimmed = stringValue.trim();
  if (!trimmed || PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
});

const insightsSchema = z.object({
  proposalName: insightField,
  clientName: insightField,
  opportunitySummary: insightField,
  financialValue: insightField,
});

export function buildPrismInsightsInput(proposalText: string, requirements: ParsedRequirement[]): string {
  const requirementText = requirements.map((r) => r.requirement).join('\n').slice(0, PRISM_REQUIREMENTS_CHARS);
  return [
    `=== PROPOSAL ===\n${proposalText.slice(0, PRISM_PROPOSAL_CHARS)}`,
    `=== REQUIREMENTS ===\n${requirementText}`,
  ].join('\n\n');
}

export function buildOdramInsightsInput(documentTexts: { filename: string; text: string }[]): string {
  return documentTexts
    .map((doc) => `=== DOCUMENT: ${doc.filename} ===\n${doc.text.slice(0, ODRAM_PER_DOCUMENT_CHARS)}`)
    .join('\n\n')
    .slice(0, ODRAM_TOTAL_CHARS);
}

function parseInsights(raw: string): ProposalInsights | null {
  const json = parseJsonObject(raw);
  if (!json) {
    return null;
  }
  const parsed = insightsSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export default async function extractProposalInsights(
  text: string,
  completionAdapter: InsightsCompletionAdapter,
): Promise<ProposalInsights | null> {
  const fenced = fenceData(text);
  const prompt = PROPOSAL_INSIGHTS_PROMPT.replace('{req.documents}', () => fenced);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await completionAdapter.complete({ prompt });
      const insights = parseInsights(response.text);
      if (insights) {
        return insights;
      }
      logger.warn('Proposal insights response did not match the expected shape', { attempt });
    } catch (error) {
      logger.warn('Proposal insights extraction attempt failed', { attempt, error: (error as Error).message });
    }
  }

  return null;
}
