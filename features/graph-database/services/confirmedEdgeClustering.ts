import { logger } from '@/server/logger';
import { UnionFind } from '@/features/graph-database/utils/unionFind';
import type { IdentityCluster } from '@/features/graph-database/dal/getIdentityClusters';
import {
  createCluster,
  attachToCluster,
  mergeClusters,
  getHubIdsForMembers,
} from '@/features/graph-database/dal/identityClusterHubs';
import type { Entity, Concept, Resolution } from '@/features/graph-database/types';

/**
 * Close the equivalence classes over confirmed `:IDENTITY` edges and the
 * existing frozen clusters.
 *
 * This REPLACES the pairwise transitivity-repair pass: because V2 emits IDENTITY
 * edges as stars from a per-block leader, each equivalence class is already a
 * connected component — there are no "A=B, B=C but A≠C" violations to repair.
 *
 * The one materialization it adds is BRIDGING: when a single new node is
 * IDENTITY to members of two previously-separate frozen clusters, those clusters
 * are now the same entity. A direct IDENTITY edge between the touched members is
 * emitted (decidedBy 'transitivity_fix') so the merge is recorded
 * cluster-to-cluster and survives independently of the bridging node — at no
 * extra LLM cost.
 *
 * Only IDENTITY is closed (never SIMILAR / RELATED_RESOLUTION).
 */
export function closeIdentityClusters(
  confirmed: Resolution[],
  frozenClusters: IdentityCluster[]
): { mergedClusters: IdentityCluster[]; bridgingEdges: Resolution[] } {
  const uf = new UnionFind<string>();

  // Map every member id to the index of its original frozen cluster.
  const frozenClusterIdByMember = new Map<string, number>();
  frozenClusters.forEach((cluster, idx) => {
    cluster.memberIds.forEach((id) => {
      uf.add(id);
      frozenClusterIdByMember.set(id, idx);
    });
    // Union the cluster's members into one component.
    for (let i = 1; i < cluster.memberIds.length; i++) {
      uf.union(cluster.memberIds[0], cluster.memberIds[i]);
    }
  });

  // Collect node objects from confirmed edges (the only nodes we can emit).
  const nodeById = new Map<string, Entity | Concept>();
  // For each new node, record one touched member object per distinct frozen cluster.
  const clusterTouchByNewNode = new Map<string, Map<number, Entity | Concept>>();

  for (const r of confirmed) {
    if (r.edgeType !== 'IDENTITY') {
      continue;
    }
    const { entity1, entity2 } = r;
    nodeById.set(entity1.id, entity1);
    nodeById.set(entity2.id, entity2);
    uf.union(entity1.id, entity2.id);

    recordClusterTouch(entity1, entity2, frozenClusterIdByMember, clusterTouchByNewNode);
    recordClusterTouch(entity2, entity1, frozenClusterIdByMember, clusterTouchByNewNode);
  }

  const bridgingEdges: Resolution[] = [];
  const emittedPairs = new Set<string>();

  for (const [newNodeId, touchedByCluster] of clusterTouchByNewNode) {
    if (touchedByCluster.size < 2) {
      continue; // only bridges ≥2 distinct existing clusters
    }
    // Star the touched members together: member[0] ↔ each other touched member.
    const members = [...touchedByCluster.values()];
    const m0 = members[0];
    for (let i = 1; i < members.length; i++) {
      const mk = members[i];
      const key = [m0.id, mk.id].sort().join('|');
      if (emittedPairs.has(key)) {
        continue;
      }
      emittedPairs.add(key);
      bridgingEdges.push(makeBridgingEdge(m0, mk, newNodeId));
    }
  }

  const mergedClusters: IdentityCluster[] = uf.groups().map((memberIds) => ({
    representativeId: [...memberIds].sort()[0],
    memberIds,
  }));

  return { mergedClusters, bridgingEdges };
}

/**
 * Materialize each multi-member equivalence class from `closeIdentityClusters`
 * as an `:IdentityCluster` hub — the structural representation reads
 * traverse. `closeIdentityClusters` stays pure (equivalence-class math only);
 * this is the I/O layered on top, called once per pass after confirmed edges
 * are known.
 *
 * For each merged cluster with ≥2 members, look up which of its members
 * already have a hub (by member id, not by trusting which frozen cluster they
 * came from — see GOTCHA below):
 *  - 0 hubs touched  → createCluster with every member (brand new cluster)
 *  - 1 hub touched   → attachToCluster for every member not already on it
 *  - ≥2 hubs touched → mergeClusters into the lexicographically smallest hub
 *                      id (deterministic, so concurrent workers converge on
 *                      the same survivor), then attachToCluster the rest
 *
 * Looking up hub membership by member id makes this self-healing for
 * clusters that predate hubs and haven't been reached by the backfill script
 * yet: a node can attach to a hub that already exists for other members of
 * its equivalence class even if the backfill hasn't run for that cluster.
 */
export interface MaintainClusterHubsStats {
  clustersProcessed: number;
  hubsCreated: number;
  membersAttached: number;
  hubsMerged: number;
}

export async function maintainClusterHubs(
  mergedClusters: IdentityCluster[],
  userId: string
): Promise<MaintainClusterHubsStats> {
  const stats: MaintainClusterHubsStats = {
    clustersProcessed: 0,
    hubsCreated: 0,
    membersAttached: 0,
    hubsMerged: 0,
  };

  const multiMember = mergedClusters.filter((cluster) => cluster.memberIds.length > 1);
  if (multiMember.length === 0) {
    return stats;
  }

  const allMemberIds = multiMember.flatMap((cluster) => cluster.memberIds);
  const hubIdByMember = await getHubIdsForMembers(allMemberIds);

  for (const cluster of multiMember) {
    const touchedHubIds = new Set<string>();
    for (const memberId of cluster.memberIds) {
      const hubId = hubIdByMember.get(memberId);
      if (hubId) {
        touchedHubIds.add(hubId);
      }
    }

    if (touchedHubIds.size === 0) {
      await createCluster(cluster.memberIds, userId);
      stats.hubsCreated++;
      stats.clustersProcessed++;
      continue;
    }

    const [survivingHubId, ...absorbedHubIds] = [...touchedHubIds].sort();
    for (const absorbedHubId of absorbedHubIds) {
      await mergeClusters(survivingHubId, absorbedHubId);
      stats.hubsMerged++;
    }

    const unattached = cluster.memberIds.filter((id) => !hubIdByMember.has(id));
    for (const memberId of unattached) {
      await attachToCluster(memberId, survivingHubId);
      stats.membersAttached++;
    }
    stats.clustersProcessed++;
  }

  logger.info('[RESOLUTION-V2] Maintained identity cluster hubs', { userId, ...stats });
  return stats;
}

/** If `other` is a frozen-cluster member and `node` is new, record the touch. */
function recordClusterTouch(
  node: Entity | Concept,
  other: Entity | Concept,
  frozenClusterIdByMember: Map<string, number>,
  clusterTouchByNewNode: Map<string, Map<number, Entity | Concept>>
): void {
  const nodeIsNew = !frozenClusterIdByMember.has(node.id);
  const otherClusterId = frozenClusterIdByMember.get(other.id);
  if (!nodeIsNew || otherClusterId === undefined) {
    return;
  }
  let touched = clusterTouchByNewNode.get(node.id);
  if (!touched) {
    touched = new Map();
    clusterTouchByNewNode.set(node.id, touched);
  }
  if (!touched.has(otherClusterId)) {
    touched.set(otherClusterId, other); // one representative member per cluster
  }
}

function makeBridgingEdge(
  n1: Entity | Concept,
  n2: Entity | Concept,
  viaNodeId: string
): Resolution {
  return {
    entity1: n1,
    entity2: n2,
    edgeType: 'IDENTITY',
    confidence: 1.0,
    rationale: `Transitivity closure: bridged via new node ${viaNodeId}`,
    decidedBy: 'transitivity_fix',
    signals: {
      cosineSimScore: 0,
      sharedAliases: [],
      sharedDoc: n1.documentId === n2.documentId,
    },
    policy: 'transitivity_enforcement',
    policyVersion: 'auto',
    resolvedAt: new Date(),
  };
}
