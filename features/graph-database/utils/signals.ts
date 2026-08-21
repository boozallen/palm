import { signalsConfig } from '@/features/graph-database/config/signals.config';
import { CandidateGenerationRule, RulePhase } from '@/features/graph-database/types/signals';

/**
 * Get all rules for a specific phase
 */
export function getRulesByPhase(phase: RulePhase): CandidateGenerationRule[] {
  return signalsConfig.candidateRules.filter(
    (rule: CandidateGenerationRule) => rule.phase === phase && rule.enabled
  );
}

/**
 * Get extraction-phase rules (for graphBuilder.ts)
 */
export function getExtractionRules(): CandidateGenerationRule[] {
  return getRulesByPhase('extraction');
}

/**
 * Get resolution-phase rules (for candidateGeneration.ts)
 */
export function getResolutionRules(): CandidateGenerationRule[] {
  return getRulesByPhase('resolution');
}
