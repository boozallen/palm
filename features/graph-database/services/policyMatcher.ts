import { resolutionPolicy } from '@/features/graph-database/config/resolution-policy.config';
import type { TripleResolutionPolicy } from '@/features/graph-database/config/resolution-policy.config';
import type { NodeCategory, ResolutionEdgeName } from '@/features/graph-database/config/storage-model.config';

/**
 * Get all applicable policies for a (from, to) node pair
 *
 * Filters policies by enabled status and matching from/to node categories.
 * Only returns policies that are both globally enabled and match the node pair.
 *
 * @param from - Source node category (ENTITY | CONCEPT)
 * @param to - Target node category (ENTITY | CONCEPT)
 * @returns Array of applicable policies
 *
 * @example
 * getApplicablePolicies('ENTITY', 'ENTITY')
 * // Returns: [IDENTITY policy, RELATED_RESOLUTION policy]
 */
export function getApplicablePolicies(
  from: NodeCategory,
  to: NodeCategory
): TripleResolutionPolicy[] {
  return resolutionPolicy.triples.filter(
    policy =>
      policy.enabled &&        // CRITICAL: Only enabled policies
      policy.from === from &&
      policy.to === to
  );
}

/**
 * Get list of allowed edge types for this node pair
 *
 * Maps enabled policies to their edge types. Returns empty array
 * if no policies are enabled for this node pair.
 *
 * @param from - Source node category (ENTITY | CONCEPT)
 * @param to - Target node category (ENTITY | CONCEPT)
 * @returns Array of allowed edge types, empty if no policies enabled
 *
 * @example
 * getEnabledEdgeTypes('ENTITY', 'ENTITY')
 * // Returns: ['IDENTITY', 'RELATED_RESOLUTION']
 *
 * getEnabledEdgeTypes('ENTITY', 'CONCEPT')
 * // Returns: ['RELATED_RESOLUTION']
 */
export function getEnabledEdgeTypes(
  from: NodeCategory,
  to: NodeCategory
): ResolutionEdgeName[] {
  const policies = getApplicablePolicies(from, to);
  return policies.map(p => p.edgeType);
}

/**
 * Check if world knowledge is allowed for ANY enabled policy
 *
 * Uses conservative approach: if ANY policy for this node pair
 * allows world knowledge, returns true. LLM can still choose
 * to use or not use world knowledge based on other policies.
 *
 * @param from - Source node category (ENTITY | CONCEPT)
 * @param to - Target node category (ENTITY | CONCEPT)
 * @returns True if any policy allows world knowledge
 *
 * @example
 * // Entity-Entity has IDENTITY (worldKnowledge=false) and RELATED (worldKnowledge=true)
 * getWorldKnowledgePolicy('ENTITY', 'ENTITY')
 * // Returns: true (allow world knowledge, LLM can still choose IDENTITY)
 *
 * // Entity-Entity IDENTITY only
 * getWorldKnowledgePolicy('ENTITY', 'ENTITY')
 * // Returns: false (strict corpus-only matching)
 */
export function getWorldKnowledgePolicy(
  from: NodeCategory,
  to: NodeCategory
): boolean {
  const policies = getApplicablePolicies(from, to);
  return policies.some(p => p.worldKnowledgeAllowed);
}

/**
 * Validate that a specific edge type is allowed by policy
 *
 * Used to validate LLM decision before creating edge in Neo4j.
 * Prevents creating edges that violate policy constraints.
 *
 * @param edgeType - Edge type to validate (IDENTITY | SIMILAR | RELATED_RESOLUTION)
 * @param from - Source node category (ENTITY | CONCEPT)
 * @param to - Target node category (ENTITY | CONCEPT)
 * @returns True if edge type is allowed by policy
 *
 * @example
 * validateEdgeTypeAllowed('IDENTITY', 'ENTITY', 'ENTITY')
 * // Returns: true
 *
 * validateEdgeTypeAllowed('SIMILAR', 'ENTITY', 'ENTITY')
 * // Returns: false (disabled by policy)
 */
export function validateEdgeTypeAllowed(
  edgeType: ResolutionEdgeName,
  from: NodeCategory,
  to: NodeCategory
): boolean {
  const allowedTypes = getEnabledEdgeTypes(from, to);
  return allowedTypes.includes(edgeType);
}
