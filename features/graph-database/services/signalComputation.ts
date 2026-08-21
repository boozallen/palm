import type { Entity, SignalVector } from '@/features/graph-database/types';

/**
 * Check if any name/alias overlap exists between two entities
 * Includes main entity name in comparison
 *
 * Example:
 *   e1: name='DHA', aliases=['Defense Health Agency']
 *   e2: name='MHS GENESIS', aliases=['DHA', 'the system']
 *   Result: true (both have 'DHA')
 */
export function computeHasNameAliasOverlap(
  e1: Entity,
  e2: Entity
): boolean {
  // Combine name + aliases for both entities
  const allNames1 = new Set(
    [e1.name, ...e1.aliases].map(n => n.toLowerCase().trim())
  );
  const allNames2 = new Set(
    [e2.name, ...e2.aliases].map(n => n.toLowerCase().trim())
  );

  // Check for any overlap
  for (const name of allNames1) {
    if (allNames2.has(name)) {
      return true;
    }
  }

  return false;
}

/**
 * Get shared names/aliases for debugging
 * Returns array of overlapping names (normalized)
 */
export function getSharedNames(
  e1: Entity,
  e2: Entity
): string[] {
  const allNames1 = new Set(
    [e1.name, ...e1.aliases].map(n => n.toLowerCase().trim())
  );
  const allNames2 = new Set(
    [e2.name, ...e2.aliases].map(n => n.toLowerCase().trim())
  );

  const shared: string[] = [];
  for (const name of allNames1) {
    if (allNames2.has(name)) {
      shared.push(name);
    }
  }

  return shared;
}

/**
 * Check if normalized main names match
 * Uses normalizedName field (lowercase, trimmed)
 */
export function computeSameName(
  e1: Entity,
  e2: Entity
): boolean {
  return e1.normalizedName === e2.normalizedName;
}

/**
 * Check if entity types match
 * Types: PERSON, ORGANIZATION, TECHNOLOGY, LOCATION, etc.
 */
export function computeSameType(
  e1: Entity,
  e2: Entity
): boolean {
  return e1.type === e2.type;
}

/**
 * Check if entities from same document
 * Uses documentId UUID comparison
 */
export function computeSameDocument(
  e1: Entity,
  e2: Entity
): boolean {
  return e1.documentId === e2.documentId;
}

/**
 * Compute all signals for an entity pair
 *
 * CRITICAL: embedding_similarity is NOT computed here!
 * It comes directly from the pgvector query result in F2.2 candidate generation.
 *
 * @param e1 - First entity
 * @param e2 - Second entity
 * @param embeddingSimilarity - Cosine similarity from pgvector (already computed)
 */
export function computeAllSignals(
  e1: Entity,
  e2: Entity,
  embeddingSimilarity: number
): SignalVector {
  return {
    embedding_similarity: embeddingSimilarity,  // From pgvector query result
    has_name_alias_overlap: computeHasNameAliasOverlap(e1, e2),
    same_name: computeSameName(e1, e2),
    same_type: computeSameType(e1, e2),
    same_document: computeSameDocument(e1, e2),
    sharedNames: getSharedNames(e1, e2),
  };
}
