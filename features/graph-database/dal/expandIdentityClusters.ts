import { getGraphDatabaseSource } from '@/features/graph-database';
import { logger } from '@/server/logger';

/**
 * Resolve a set of seed node ids to their complete cluster membership (seed
 * included), filtered to the caller's documentIds.
 *
 * The single seam every IDENTITY-cluster-traversal call site delegates
 * through — see .agents/plans/graph-identity-cluster-traversal.md. Cluster
 * membership is a fixed 2-hop lookup through the `:IdentityCluster` hub node
 * (member -> hub <- other members), not a variable-depth IDENTITY traversal —
 * see .agents/plans/entity-resolution-identity-cluster-hubs.md. A hub is a
 * structural join point only (no content); the `:IDENTITY` edges remain the
 * audit trail but are no longer what this traversal reads.
 *
 * Read-path only: does not scope by userId. Access is enforced by the
 * documentId filter, matching the document-scoped read path (see
 * getOneHopExpansion) so shared/admin-group documents remain reachable.
 *
 * @param nodeIds - seed node `id` property values (Entity or Concept ids).
 * @param documentIds - restricts the seed AND its cluster members to these
 *   documents. Seeds outside them get no expansion: callers may pass
 *   untrusted ids, and expanding an out-of-scope seed would confirm which
 *   accessible entities it resolves to.
 * @returns Map from each input seed id to its full cluster ids (including
 *   the seed). A seed with no hub (or outside documentIds, or none of its
 *   cluster within documentIds) maps to `[seedId]`.
 */
export async function expandIdentityClusters(
  nodeIds: string[],
  documentIds: string[]
): Promise<Map<string, string[]>> {
  if (nodeIds.length === 0) {
    return new Map();
  }

  const query = `
    UNWIND $nodeIds AS nid
    MATCH (n:Entity|Concept {id: nid})
    WHERE n.documentId IN $documentIds
    OPTIONAL MATCH (n)-[:IN_CLUSTER]->(:IdentityCluster)<-[:IN_CLUSTER]-(m)
    WHERE m.documentId IN $documentIds
    RETURN nid AS seedId, [nid] + collect(DISTINCT m.id) AS clusterIds
  `;

  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(query, { nodeIds, documentIds });

    const clusterMap = new Map<string, string[]>();
    let maxClusterSize = 0;
    for (const record of result.records) {
      const seedId = record.get('seedId') as string;
      const clusterIds = record.get('clusterIds') as string[];
      clusterMap.set(seedId, clusterIds);
      maxClusterSize = Math.max(maxClusterSize, clusterIds.length);
    }

    // Seeds not present in the graph (or filtered out entirely) still resolve
    // to themselves, so callers never lose a seed from the map.
    for (const nid of nodeIds) {
      if (!clusterMap.has(nid)) {
        clusterMap.set(nid, [nid]);
      }
    }

    logger.info('[IDENTITY-CLUSTER] Expanded seeds to full cluster membership', {
      seedCount: nodeIds.length,
      expandedCount: clusterMap.size,
      maxClusterSize,
    });

    return clusterMap;
  } catch (error) {
    logger.error('[IDENTITY-CLUSTER] Failed to expand identity clusters', {
      seedCount: nodeIds.length,
      error,
    });
    throw new Error('Failed to expand identity clusters');
  }
}
