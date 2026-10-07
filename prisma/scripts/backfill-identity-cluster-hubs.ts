/**
 * Manual escape hatch for `:IdentityCluster` hub reconciliation.
 *
 * The graph-build-worker runs the same reconciliation automatically at
 * startup (see reconcileIdentityClusterHubs), so this script is only needed
 * to converge an environment without restarting the worker. Idempotent —
 * a converged environment reports all-zero stats.
 *
 * Not a Prisma migration — Neo4j is schemaless and this touches Neo4j only.
 * Lives alongside the other Neo4j-only backfills (see backfill-graph-userId.ts)
 * rather than under the top-level scripts/ dir, which is locally
 * git-excluded and would never ship this file to another environment.
 *
 * Usage:
 * docker exec -it frontend yarn ts-node -r tsconfig-paths/register prisma/scripts/backfill-identity-cluster-hubs.ts
 */

import { reconcileIdentityClusterHubs } from '@/features/graph-database/services/reconcileIdentityClusterHubs';

reconcileIdentityClusterHubs()
  .then((stats) => {
    console.log('[BACKFILL] Complete', stats);
    console.log('[BACKFILL] Re-run to confirm idempotency (all counters should be 0 on the next pass).');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[BACKFILL] Failed:', error);
    process.exit(1);
  });
