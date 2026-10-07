import { getGraphDatabaseSource } from '@/features/graph-database';
import { logger } from '@/server/logger';

/**
 * CRUD for `:IdentityCluster` hub nodes — the structural join point for a
 * resolved entity/concept cluster. A hub owns no content (no name, no
 * description, no embedding); members point at it via `:IN_CLUSTER`.
 * Deleting a member (via deleteGraphNodes' DETACH DELETE) removes only that
 * member's edge — the hub and remaining members are untouched.
 *
 * Hubs carry `userId` but never `documentId`: they are not document-scoped,
 * so callers must always project back to members (which do carry
 * `documentId`) and filter there. See
 * .agents/plans/entity-resolution-identity-cluster-hubs.md.
 */

/**
 * Create a new hub and attach the given members to it in one write.
 *
 * The hub id is generated in Cypher (`randomUUID()`), not in TS, matching the
 * convention in `copyGraphData.ts`. Members that no longer resolve to a node
 * (deleted between candidate surfacing and this write) are silently skipped
 * via `OPTIONAL MATCH` rather than failing the whole cluster creation.
 */
export async function createCluster(memberIds: string[], userId: string): Promise<string> {
  if (memberIds.length === 0) {
    throw new Error('createCluster requires at least one member id');
  }

  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(
      `CREATE (h:IdentityCluster {id: randomUUID(), userId: $userId})
       WITH h
       UNWIND $memberIds AS memberId
       OPTIONAL MATCH (m:Entity|Concept {id: memberId})
       FOREACH (_ IN CASE WHEN m IS NOT NULL THEN [1] ELSE [] END |
         MERGE (m)-[:IN_CLUSTER]->(h)
       )
       RETURN h.id AS hubId
       LIMIT 1`,
      { memberIds, userId }
    );

    const hubId = result.records[0]?.get('hubId') as string | undefined;
    if (!hubId) {
      throw new Error('Cluster creation returned no hub id');
    }

    logger.info('[IDENTITY-CLUSTER-HUBS] Created cluster', {
      hubId,
      userId,
      memberCount: memberIds.length,
    });
    return hubId;
  } catch (error) {
    logger.error('[IDENTITY-CLUSTER-HUBS] Failed to create cluster', { userId, memberIds, error });
    throw new Error('Failed to create identity cluster');
  }
}

/**
 * Bulk variant of createCluster for reconciliation: create one hub per
 * cluster and attach all members, hundreds of clusters per statement instead
 * of two round-trips each. Callers must pre-verify no member already has a
 * hub — this path never attaches to or merges with existing hubs (that's
 * maintainClusterHubs' job).
 *
 * Same member semantics as createCluster: deleted members are silently
 * skipped via `OPTIONAL MATCH` + `FOREACH`.
 *
 * @returns number of hubs created.
 */
export async function bulkCreateClusters(
  clusters: Array<{ memberIds: string[] }>,
  userId: string
): Promise<number> {
  if (clusters.length === 0) {
    return 0;
  }

  const CHUNK_SIZE = 500;
  let hubsCreated = 0;

  try {
    const graphDb = await getGraphDatabaseSource();

    for (let i = 0; i < clusters.length; i += CHUNK_SIZE) {
      const chunk = clusters.slice(i, i + CHUNK_SIZE).map((c) => ({ memberIds: c.memberIds }));
      const result = await graphDb.run(
        `UNWIND $clusters AS cluster
         CREATE (h:IdentityCluster {id: randomUUID(), userId: $userId})
         WITH h, cluster
         UNWIND cluster.memberIds AS memberId
         OPTIONAL MATCH (m:Entity|Concept {id: memberId})
         FOREACH (_ IN CASE WHEN m IS NOT NULL THEN [1] ELSE [] END |
           MERGE (m)-[:IN_CLUSTER]->(h)
         )
         RETURN count(DISTINCT h) AS hubsCreated`,
        { clusters: chunk, userId }
      );
      hubsCreated += Number(result.records[0]?.get('hubsCreated') ?? 0);
    }

    logger.info('[IDENTITY-CLUSTER-HUBS] Bulk-created clusters', {
      userId,
      hubsCreated,
      clusterCount: clusters.length,
    });
    return hubsCreated;
  } catch (error) {
    logger.error('[IDENTITY-CLUSTER-HUBS] Failed to bulk-create clusters', {
      userId,
      clusterCount: clusters.length,
      error,
    });
    throw new Error('Failed to bulk-create identity clusters');
  }
}

/**
 * Attach one node to an existing hub. Idempotent via `MERGE` — safe to call
 * more than once for the same (nodeId, hubId) pair.
 */
export async function attachToCluster(nodeId: string, hubId: string): Promise<void> {
  try {
    const graphDb = await getGraphDatabaseSource();
    await graphDb.run(
      `MATCH (n:Entity|Concept {id: $nodeId})
       MATCH (h:IdentityCluster {id: $hubId})
       MERGE (n)-[:IN_CLUSTER]->(h)`,
      { nodeId, hubId }
    );
    logger.info('[IDENTITY-CLUSTER-HUBS] Attached node to cluster', { nodeId, hubId });
  } catch (error) {
    logger.error('[IDENTITY-CLUSTER-HUBS] Failed to attach node to cluster', { nodeId, hubId, error });
    throw new Error('Failed to attach node to identity cluster');
  }
}

/**
 * Merge two hubs: re-point every `:IN_CLUSTER` edge from `absorbedHubId` to
 * `survivingHubId`, then delete the now-empty absorbed hub.
 *
 * Idempotent and order-independent in the sense that matters for concurrent
 * workers: callers must pick the same (surviving, absorbed) assignment for a
 * given hub pair (e.g. lower id survives) so concurrent merges converge
 * instead of fighting. A second call against an already-merged pair is a
 * no-op (the absorbed hub no longer matches).
 */
export async function mergeClusters(survivingHubId: string, absorbedHubId: string): Promise<void> {
  if (survivingHubId === absorbedHubId) {
    return;
  }

  try {
    const graphDb = await getGraphDatabaseSource();

    // Batched so a large cluster (hundreds/thousands of members) doesn't
    // blow one transaction — mirrors deleteGraphNodes.ts.
    await graphDb.run(
      `MATCH (m)-[r:IN_CLUSTER]->(absorbed:IdentityCluster {id: $absorbedHubId})
       MATCH (surviving:IdentityCluster {id: $survivingHubId})
       CALL {
         WITH m, r, surviving
         MERGE (m)-[:IN_CLUSTER]->(surviving)
         DELETE r
       } IN TRANSACTIONS OF 1000 ROWS`,
      { survivingHubId, absorbedHubId }
    );

    // Only delete the absorbed hub once it's verifiably empty — defends
    // against a concurrent writer having attached a new member mid-merge.
    await graphDb.run(
      `MATCH (h:IdentityCluster {id: $absorbedHubId})
       WHERE NOT (h)<-[:IN_CLUSTER]-()
       DETACH DELETE h`,
      { absorbedHubId }
    );

    logger.info('[IDENTITY-CLUSTER-HUBS] Merged clusters', { survivingHubId, absorbedHubId });
  } catch (error) {
    logger.error('[IDENTITY-CLUSTER-HUBS] Failed to merge clusters', {
      survivingHubId,
      absorbedHubId,
      error,
    });
    throw new Error('Failed to merge identity clusters');
  }
}

/**
 * Reverse-lookup: for each member id that already has a hub, its hub id.
 * Members with no hub are simply absent from the returned map — used by
 * confirmedEdgeClustering to decide create vs. attach vs. merge without
 * trusting a caller-supplied "which hub is this" assumption.
 */
export async function getHubIdsForMembers(memberIds: string[]): Promise<Map<string, string>> {
  if (memberIds.length === 0) {
    return new Map();
  }

  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(
      `UNWIND $memberIds AS memberId
       MATCH (m:Entity|Concept {id: memberId})-[:IN_CLUSTER]->(h:IdentityCluster)
       RETURN memberId, h.id AS hubId`,
      { memberIds }
    );

    const hubIdByMember = new Map<string, string>();
    for (const record of result.records) {
      hubIdByMember.set(record.get('memberId') as string, record.get('hubId') as string);
    }
    return hubIdByMember;
  } catch (error) {
    logger.error('[IDENTITY-CLUSTER-HUBS] Failed to look up hubs for members', { memberIds, error });
    throw new Error('Failed to look up identity cluster hubs for members');
  }
}
