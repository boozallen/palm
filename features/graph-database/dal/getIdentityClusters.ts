import { getGraphDatabaseSource } from '@/features/graph-database';
import { logger } from '@/server/logger';

/**
 * A frozen, already-resolved equivalence class of existing nodes, backed by
 * an `:IdentityCluster` hub. Used by V2 resolution so existing×existing pairs
 * within a cluster are never re-judged, and so new nodes can be assigned into
 * (or bridge) known clusters.
 *
 * NAMING NOTE: this TS interface shares its name with the `:IdentityCluster`
 * Neo4j label but is NOT the same shape — the Neo4j hub node owns no content
 * (no memberIds, no name), it is purely a join point members point at via
 * `:IN_CLUSTER`. This interface is the *query result* of joining a hub to its
 * members: `representativeId` is the hub's real `id` (a comparison/anchoring
 * key — see clusterResolution.pickAnchor — not a cluster member, and does NOT
 * canonicalize or merge nodes in the graph); `memberIds` comes from
 * `:IN_CLUSTER`. See .agents/plans/entity-resolution-identity-cluster-hubs.md.
 */
export interface IdentityCluster {
  representativeId: string;
  memberIds: string[];
}

/**
 * Load existing resolved equivalence classes for a user, read directly from
 * `:IdentityCluster` hubs (fixed-shape 2-hop query) rather than derived by
 * union-find over `:IDENTITY` edges. Nodes with no hub are not clusters (they
 * are plain existing singletons and reach the decision layer via candidate
 * search).
 *
 * @param userId - owning user; the real isolation bound.
 * @param documentIds - optional. When provided, restricts cluster membership
 *   to members living in those documents. Omit (the orchestrator's call) to
 *   load all of the user's clusters — required for cross-document
 *   correctness and bridging.
 */
export async function getIdentityClusters(
  userId: string,
  documentIds?: string[]
): Promise<IdentityCluster[]> {
  const graphDb = await getGraphDatabaseSource();

  const scoped = !!documentIds && documentIds.length > 0;
  const scopeFilter = scoped ? '\n       WHERE m.documentId IN $documentIds' : '';
  const query = `MATCH (h:IdentityCluster {userId: $userId})<-[:IN_CLUSTER]-(m)${scopeFilter}
       WITH h, collect(m.id) AS memberIds
       WHERE size(memberIds) > 1
       RETURN h.id AS hubId, memberIds`;

  const result = await graphDb.run(query, scoped ? { userId, documentIds } : { userId });

  const clusters: IdentityCluster[] = result.records.map((record) => ({
    representativeId: record.get('hubId') as string,
    memberIds: record.get('memberIds') as string[],
  }));

  logger.info('[RESOLUTION-V2] Loaded frozen identity clusters', {
    userId,
    scoped,
    clusterCount: clusters.length,
    clusteredNodes: clusters.reduce((n, c) => n + c.memberIds.length, 0),
  });

  return clusters;
}
