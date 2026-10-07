import { logger } from '@/server/logger';

/**
 * Known relationship types that can be extracted
 */
export const KNOWN_RELATIONSHIP_TYPES = [
  // Organizational
  'WORKS_FOR',
  'MANAGES',
  'REPORTS_TO',
  'MEMBER_OF',
  // Structural
  'PART_OF',
  'SUBSIDIARY_OF',
  'DIVISION_OF',
  'OWNS',
  // Locational
  'LOCATED_IN',
  'BASED_IN',
  'OPERATES_IN',
  // Conceptual
  'RELATES_TO',
  'REQUIRES',
  'IMPLEMENTS',
  'USES',
  // Temporal
  'SUCCEEDED_BY',
  'PRECEDED_BY',
] as const;

export type KnownRelationshipType = typeof KNOWN_RELATIONSHIP_TYPES[number];

/**
 * Validate and normalize relationship type.
 *
 * When `allowedTypes` is provided (a schema's edge-type list), the type is
 * validated against it instead of `KNOWN_RELATIONSHIP_TYPES`. In both cases the
 * "accept unknown, normalize" behavior is preserved — unknown types are
 * normalized and returned, not dropped (strict-drop is deferred).
 */
export function validateRelationshipType(extractedType: string, allowedTypes?: string[]): string {
  const normalized = extractedType.toUpperCase().replace(/\s+/g, '_');

  const allowList = allowedTypes
    ? allowedTypes.map((t) => t.toUpperCase().replace(/\s+/g, '_'))
    : (KNOWN_RELATIONSHIP_TYPES as readonly string[]);

  if (allowList.includes(normalized)) {
    return normalized;
  }

  logger.debug(`Unknown relationship type: ${extractedType}, normalized to: ${normalized}`);
  return normalized;  // Extensible - accept unknown types
}

/**
 * Find source and target nodes in extraction results
 */
export function findRelationshipNodes(
  sourceName: string,
  targetName: string,
  entities: Array<{ text: string }>,
  concepts: Array<{ name: string }>
): { source: { name: string; type: 'entity' | 'concept' }; target: { name: string; type: 'entity' | 'concept' } } | null {
  const sourceEntity = entities.find(e => e.text === sourceName);
  const sourceConcept = concepts.find(c => c.name === sourceName);
  const targetEntity = entities.find(e => e.text === targetName);
  const targetConcept = concepts.find(c => c.name === targetName);

  if (!sourceEntity && !sourceConcept) {
    logger.warn(`Source node not found: ${sourceName}`);
    return null;
  }

  if (!targetEntity && !targetConcept) {
    logger.warn(`Target node not found: ${targetName}`);
    return null;
  }

  return {
    source: { name: sourceName, type: sourceEntity ? 'entity' : 'concept' },
    target: { name: targetName, type: targetEntity ? 'entity' : 'concept' },
  };
}
