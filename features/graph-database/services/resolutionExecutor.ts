import { getGraphDatabaseSource } from '@/features/graph-database';
import { logger } from '@/server/logger';
import type { Resolution, Entity, Concept } from '@/features/graph-database/types';

/**
 * Type guard to check if a node is a Concept
 * F2.7: Concept Resolution
 *
 * Concepts have 'category' field (ConceptCategory enum) but no 'type' field
 * Entities have 'type' field (EntityType enum) but no 'category' field
 */
function isConceptNode(node: Entity | Concept): node is Concept {
  return 'category' in node && !('type' in node);
}

/**
 * Persist resolutions as Neo4j edges
 *
 * Creates undirected edges in Neo4j with unified property schema.
 * Maps RELATED_RESOLUTION → RELATED for unified storage schema
 * Uses MERGE to avoid duplicate edges.
 * F2.7: Extended to support both Entity and Concept nodes
 *
 * @param resolutions - Array of resolution objects from resolveEntitiesV2()
 * @returns Promise that resolves when all edges are created
 *
 * @example
 * await persistResolutions(resolutions);
 * // Creates edges in graph database with all required properties
 */
export async function persistResolutions(resolutions: Resolution[]): Promise<void> {
  logger.info(`Persisting ${resolutions.length} resolution edges to graph database`);

  const graphDb = await getGraphDatabaseSource();

  for (const resolution of resolutions) {
    const {
      entity1, entity2, edgeType, confidence, rationale,
      decidedBy, signals, policy, policyVersion, resolvedAt,
    } = resolution;

    // F2.7: Determine node labels dynamically
    const label1 = isConceptNode(entity1) ? 'Concept' : 'Entity';
    const label2 = isConceptNode(entity2) ? 'Concept' : 'Entity';

    // CRITICAL: Map RELATED_RESOLUTION → RELATED for graph database
    const neoEdgeType = edgeType === 'RELATED_RESOLUTION' ? 'RELATED' : edgeType;

    try {
      // CRITICAL: MERGE creates undirected edge (hyphen on BOTH sides)
      // F2.7: Use dynamic node labels
      await graphDb.run(`
        MATCH (n1:${label1} {id: $e1Id})
        MATCH (n2:${label2} {id: $e2Id})
        MERGE (n1)-[r:${neoEdgeType}]-(n2)
        SET r.id = randomUUID(),
            r.phase = 'resolution',
            r.confidence = $confidence,
            r.decidedBy = $decidedBy,
            r.cosineSimScore = $cosineSimScore,
            r.sharedAliases = $sharedAliases,
            r.sharedDoc = $sharedDoc,
            r.rationale = $rationale,
            r.policy = $policy,
            r.policyVersion = $policyVersion,
            r.resolvedAt = datetime($resolvedAt)
      `, {
        e1Id: entity1.id,
        e2Id: entity2.id,
        confidence,
        decidedBy,
        cosineSimScore: signals.cosineSimScore,
        sharedAliases: signals.sharedAliases || [],
        sharedDoc: signals.sharedDoc,
        rationale,
        policy,
        policyVersion,
        resolvedAt: resolvedAt.toISOString(),
      });

      logger.debug(`Created ${neoEdgeType} edge: ${entity1.name} <-> ${entity2.name}`);
    } catch (error) {
      logger.error(`Failed to create edge for ${entity1.name} <-> ${entity2.name}:`, error);
      // PATTERN: Don't throw - continue processing other resolutions
    }
  }

  logger.info(`Successfully persisted ${resolutions.length} resolution edges`);
}
