import type { Concept, SignalVector } from '@/features/graph-database/types';
import { getResolutionRules } from '@/features/graph-database/utils/signals';
import type { CandidateGenerationRule } from '@/features/graph-database/types/signals';

/**
 * Check if entity pair meets any RESOLUTION-PHASE filtering rules
 * Returns rule name if qualified, null if rejected
 *
 * Rules are defined in signals.config.ts with phase: 'resolution'
 * This function only evaluates resolution-phase rules (cross-document linking)
 * Extraction-phase rules (same-document merging) are handled in graphBuilder.ts
 */
export function meetsResolutionRules(signals: SignalVector): string | null {
  const resolutionRules = getResolutionRules();

  for (const rule of resolutionRules) {
    if (matchesRule(signals, rule)) {
      return rule.name;
    }
  }

  return null;
}

/**
 * Check if signals match a specific rule's thresholds
 *
 * Signal mapping:
 * - same_document: signals.same_document (boolean → 1/0)
 * - exact_name_match: signals.same_name (boolean → 1/0)
 * - alias_overlap: signals.has_name_alias_overlap (boolean → 1/0)
 * - embedding_similarity: signals.embedding_similarity (0-1)
 */
function matchesRule(signals: SignalVector, rule: CandidateGenerationRule): boolean {
  const { thresholds } = rule;

  // Map SignalVector to threshold-comparable values
  const signalValues: Record<string, number> = {
    same_document: signals.same_document ? 1 : 0,
    exact_name_match: signals.same_name ? 1 : 0,
    alias_overlap: signals.has_name_alias_overlap ? 1 : 0,
    embedding_similarity: signals.embedding_similarity,
  };

  // Check each threshold in the rule
  for (const [signalName, threshold] of Object.entries(thresholds)) {
    const signalValue = signalValues[signalName];

    // Special case: same_document threshold of 0 means "must be cross-document"
    if (signalName === 'same_document' && threshold === 0) {
      if (signalValue !== 0) {
        return false;  // Rule requires cross-doc, but this is same-doc
      }
      continue;
    }

    // Standard threshold check: signal must meet or exceed threshold
    if (signalValue < threshold) {
      return false;
    }
  }

  return true;
}

/**
 * Compute signals for concept pairs
 * F2.7: Concept Resolution
 *
 * NOTE: Concepts don't have aliases or normalizedName fields
 * Therefore:
 * - has_name_alias_overlap: Based on main name only
 * - same_name: Simple name comparison (case-insensitive)
 * - same_type: Uses category instead (TECHNICAL, BUSINESS, etc.)
 */
export function computeConceptSignals(
  c1: Concept,
  c2: Concept,
  embeddingSimilarity: number
): SignalVector {
  const name1 = c1.name.toLowerCase().trim();
  const name2 = c2.name.toLowerCase().trim();

  return {
    embedding_similarity: embeddingSimilarity,
    has_name_alias_overlap: name1 === name2,  // Only main name comparison
    same_name: name1 === name2,
    same_type: c1.category === c2.category,  // Use category for concepts
    same_document: c1.documentId === c2.documentId,
    sharedNames: name1 === name2 ? [name1] : [],
  };
}
