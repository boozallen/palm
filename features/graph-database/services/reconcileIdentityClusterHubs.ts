import { logger } from '@/server/logger';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { UnionFind } from '@/features/graph-database/utils/unionFind';
import { maintainClusterHubs } from '@/features/graph-database/services/confirmedEdgeClustering';
import { bulkCreateClusters, getHubIdsForMembers } from '@/features/graph-database/dal/identityClusterHubs';
import type { IdentityCluster } from '@/features/graph-database/dal/getIdentityClusters';

/**
 * Enforce the hub invariant: every multi-member `:IDENTITY` equivalence class
 * has an `:IdentityCluster` hub with all members attached.
 *
 * Normally a no-op — the resolution write path maintains hubs as clusters
 * form (see maintainClusterHubs). This reconciliation exists for IDENTITY
 * edges written without hub maintenance: clusters that predate the hub
 * representation (the deploy-day migration), legacy V1 resolution output,
 * or a partially-failed maintenance pass. Runs at graph-build-worker startup
 * and via the manual escape hatch
 * `prisma/scripts/backfill-identity-cluster-hubs.ts`.
 *
 * Idempotent and cheap when converged: the discovery query doubles as the
 * pre-check, returning no users when every resolved node already has a hub.
 *
 * IMPORTANT: derives clusters directly via union-find over raw `:IDENTITY`
 * edges rather than calling getIdentityClusters — that DAL reads hubs, which
 * would make this a no-op on exactly the un-hubbed data it exists to repair.
 */

export interface ReconcileIdentityClusterHubsStats {
  usersReconciled: number;
  clustersProcessed: number;
  membersProcessed: number;
  hubsCreated: number;
  membersAttached: number;
  hubsMerged: number;
}

/**
 * Pre-check + discovery in one query: userIds owning a node that has an
 * `:IDENTITY` edge but no hub membership. Empty result = invariant holds.
 * Same-type IDENTITY pairs only, mirroring the resolution write path.
 */
async function findUserIdsWithUnhubbedMembers(): Promise<string[]> {
  const graphDb = await getGraphDatabaseSource();
  const result = await graphDb.run(`
    MATCH (n:Entity)-[:IDENTITY]-(:Entity)
    WHERE n.userId IS NOT NULL AND NOT (n)-[:IN_CLUSTER]->(:IdentityCluster)
    RETURN DISTINCT n.userId AS userId
    UNION
    MATCH (n:Concept)-[:IDENTITY]-(:Concept)
    WHERE n.userId IS NOT NULL AND NOT (n)-[:IN_CLUSTER]->(:IdentityCluster)
    RETURN DISTINCT n.userId AS userId
  `);
  return result.records.map((record) => record.get('userId') as string);
}

/**
 * Connected components over a user's raw `:IDENTITY` edges — the derivation
 * getIdentityClusters used before it was swapped to read hubs directly.
 */
async function deriveIdentityClustersFromEdges(userId: string): Promise<IdentityCluster[]> {
  const graphDb = await getGraphDatabaseSource();
  const query = `MATCH (a:Entity {userId: $userId})-[:IDENTITY]-(b:Entity)
       WHERE b.userId = $userId
       RETURN a.id AS aId, b.id AS bId
       UNION ALL
       MATCH (a:Concept {userId: $userId})-[:IDENTITY]-(b:Concept)
       WHERE b.userId = $userId
       RETURN a.id AS aId, b.id AS bId`;

  const result = await graphDb.run(query, { userId });

  const uf = new UnionFind<string>();
  for (const record of result.records) {
    const aId = record.get('aId') as string;
    const bId = record.get('bId') as string;
    if (aId && bId) {
      uf.union(aId, bId);
    }
  }

  return uf
    .groups()
    .filter((memberIds) => memberIds.length > 1)
    .map((memberIds) => ({
      representativeId: [...memberIds].sort()[0],
      memberIds,
    }));
}

/**
 * Existing hub membership for every member across the given clusters,
 * chunked so a large user's member list never becomes one oversized query.
 */
async function lookupHubMembership(clusters: IdentityCluster[]): Promise<Map<string, string>> {
  const CHUNK_SIZE = 5000;
  const allMemberIds = clusters.flatMap((c) => c.memberIds);
  const hubIdByMember = new Map<string, string>();

  for (let i = 0; i < allMemberIds.length; i += CHUNK_SIZE) {
    const chunk = await getHubIdsForMembers(allMemberIds.slice(i, i + CHUNK_SIZE));
    for (const [memberId, hubId] of chunk) {
      hubIdByMember.set(memberId, hubId);
    }
  }
  return hubIdByMember;
}

export async function reconcileIdentityClusterHubs(): Promise<ReconcileIdentityClusterHubsStats> {
  const stats: ReconcileIdentityClusterHubsStats = {
    usersReconciled: 0,
    clustersProcessed: 0,
    membersProcessed: 0,
    hubsCreated: 0,
    membersAttached: 0,
    hubsMerged: 0,
  };

  const userIds = await findUserIdsWithUnhubbedMembers();
  if (userIds.length === 0) {
    logger.info('[HUB-RECONCILE] Hub invariant holds — nothing to reconcile');
    return stats;
  }

  logger.info('[HUB-RECONCILE] Found users with un-hubbed IDENTITY members', {
    userCount: userIds.length,
  });

  for (const userId of userIds) {
    const clusters = await deriveIdentityClustersFromEdges(userId);
    if (clusters.length === 0) {
      continue;
    }

    // Split by existing hub membership: clusters touching no hub (deploy
    // day: virtually all) take the bulk-create fast path; clusters touching
    // existing hubs need maintainClusterHubs' attach/merge semantics.
    const hubIdByMember = await lookupHubMembership(clusters);
    const untouched = clusters.filter((c) => !c.memberIds.some((id) => hubIdByMember.has(id)));
    const touched = clusters.filter((c) => c.memberIds.some((id) => hubIdByMember.has(id)));

    const bulkHubsCreated = await bulkCreateClusters(untouched, userId);
    const userStats = touched.length > 0
      ? await maintainClusterHubs(touched, userId)
      : { clustersProcessed: 0, hubsCreated: 0, membersAttached: 0, hubsMerged: 0 };
    const memberCount = clusters.reduce((n, c) => n + c.memberIds.length, 0);

    stats.usersReconciled += 1;
    stats.clustersProcessed += untouched.length + userStats.clustersProcessed;
    stats.membersProcessed += memberCount;
    stats.hubsCreated += bulkHubsCreated + userStats.hubsCreated;
    stats.membersAttached += userStats.membersAttached;
    stats.hubsMerged += userStats.hubsMerged;

    logger.info('[HUB-RECONCILE] Reconciled user', {
      userId,
      clusters: clusters.length,
      members: memberCount,
      hubsCreated: bulkHubsCreated + userStats.hubsCreated,
      membersAttached: userStats.membersAttached,
      hubsMerged: userStats.hubsMerged,
    });
  }

  logger.info('[HUB-RECONCILE] Reconciliation complete', { ...stats });
  return stats;
}
