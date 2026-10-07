/**
 * @jest-environment node
 *
 * Integration tests for the doc-id-based graph access model.
 *
 * Requires running Neo4j + Postgres locally (docker compose up -d).
 * If Neo4j isn't reachable, the suite is skipped.
 *
 * Scope: this file proves the load-bearing access-model invariants end-to-end
 * against real Postgres + Neo4j:
 *   - getAccessibleDocumentIds returns the correct set for each user shape
 *     (personal, admin-via-group, neither) — the foundation of the new model.
 *   - assertDocumentAccess rejects at the boundary in each failure shape
 *     (Action 4a–4d).
 *   - Defense-in-depth: read-path DALs that take accessibleDocIds filter
 *     correctly even when called with a non-accessible nodeId/anchorId
 *     (Action 5b).
 *
 * Out of scope (covered by unit tests or marked as follow-up below):
 *   - Per-route Forbidden propagation (covered by features/chat/routes/*.test.ts
 *     and features/shared/routes/document-library/upload/get-document-content.test.ts).
 *   - Full chat read-path orchestration across 11 sub-paths (Actions 2a/2b/3).
 *   - Workflow processDocuments filtering (Action 8) — requires execute-workflow
 *     route wiring.
 *   - Worker silent-fail-closed via processChatJob (Action 10) — requires
 *     ChatJobData synthesis + Chat row setup + AI provider mock.
 */

import db from '@/server/db';
import {
  GraphDatabaseFactory,
  _resetGraphDatabaseSourceForTesting,
} from '@/features/graph-database/factory';
import type { GraphDatabaseSource } from '@/features/graph-database/sources/types';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';
import assertDocumentAccess from '@/features/shared/utils/assertDocumentAccess';
import { getScopedGraphSchema } from '@/features/graph-database/dal/getGraphSchema';
import { getNodeNeighbors } from '@/features/graph-database/dal/getNodeNeighbors';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';
import type { ContextType } from '@/server/trpc-context';
import {
  seedShareTestGraph,
  teardownShareTestGraph,
  type SeededIds,
} from './seedShareTestGraph';

const TEST_TIMEOUT = 60_000;

const silentLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

async function neo4jReachable(): Promise<{
  source: GraphDatabaseSource | null;
  reachable: boolean;
}> {
  try {
    const factory = new GraphDatabaseFactory();
    const { source } = await factory.buildAndConnect();
    const ok = await source.healthCheck();
    if (!ok) {
      await source.disconnect();
      return { source: null, reachable: false };
    }
    return { source, reachable: true };
  } catch {
    return { source: null, reachable: false };
  }
}

function buildCtx(userId: string): ContextType {
  let cache: AccessibleDocIds | undefined;
  return {
    userId,
    logger: silentLogger,
    getAccessibleDocIds: async () => {
      if (!cache) {
        cache = await getAccessibleDocumentIds(userId);
      }
      return cache;
    },
  } as unknown as ContextType;
}

function freshSuffix(): string {
  return Math.random().toString(16).slice(2, 10).padEnd(8, '0');
}

describe('admin-share-graph-access (integration)', () => {
  let graphDb: GraphDatabaseSource | null = null;
  let suiteEnabled = false;
  let ids: SeededIds | null = null;

  beforeAll(async () => {
    const probe = await neo4jReachable();
    suiteEnabled = probe.reachable;
    graphDb = probe.source;
    if (!suiteEnabled) {
      // eslint-disable-next-line no-console
      console.warn('[admin-share-graph-access.integration] Neo4j unreachable, skipping suite');
      return;
    }
    try {
      await getAccessibleDocumentIds('00000000-0000-0000-0000-000000000000');
    } catch {
      suiteEnabled = false;
      // eslint-disable-next-line no-console
      console.warn('[admin-share-graph-access.integration] Postgres schema not migrated (accessUsers relation missing) — run migrations first, skipping suite');
    }
  }, TEST_TIMEOUT);

  afterEach(async () => {
    if (suiteEnabled && graphDb && ids) {
      await teardownShareTestGraph(graphDb, db, ids);
      ids = null;
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (graphDb) {
      await graphDb.disconnect();
    }
    _resetGraphDatabaseSourceForTesting();
  });

  function maybeIt(name: string, fn: () => Promise<void>, timeout = TEST_TIMEOUT) {
    return it(
      name,
      async () => {
        if (!suiteEnabled || !graphDb) { return; }
        await fn();
      },
      timeout,
    );
  }

  // ============================================================
  // FOUNDATION: getAccessibleDocumentIds resolves the right set.
  // This is the predicate the entire boundary depends on. If it's
  // wrong, every downstream invariant inherits the bug.
  // ============================================================

  maybeIt('User A (Finance member) gets personal docs + admin-shared doc', async () => {
    ids = await seedShareTestGraph(graphDb!, db, {
      runSuffix: freshSuffix(),
      admin: { includeAdmin: true },
    });

    const accessible = await getAccessibleDocumentIds(ids.userA);

    expect(accessible.has(ids.docA1)).toBe(true);
    expect(accessible.has(ids.docA2)).toBe(true);
    expect(accessible.has(ids.docA3)).toBe(true);
    expect(accessible.has(ids.docAdmin!)).toBe(true);
    // Cross-tenant isolation: User A does NOT see User C's personal doc.
    expect(accessible.has(ids.docC1)).toBe(false);
  });

  maybeIt('User B (Marketing member) gets no admin doc — group lacks AdminDocumentGroup row', async () => {
    ids = await seedShareTestGraph(graphDb!, db, {
      runSuffix: freshSuffix(),
      admin: { includeAdmin: true },
    });

    const accessible = await getAccessibleDocumentIds(ids.userB);

    // User B's group (Marketing) is not assigned to D_admin → must not appear.
    expect(accessible.has(ids.docAdmin!)).toBe(false);
    // User B has no personal docs in the seed.
    expect(accessible.has(ids.docA1)).toBe(false);
    expect(accessible.has(ids.docC1)).toBe(false);
  });

  maybeIt('User C (in no admin group) sees only own personal doc', async () => {
    ids = await seedShareTestGraph(graphDb!, db, {
      runSuffix: freshSuffix(),
      admin: { includeAdmin: true },
    });

    const accessible = await getAccessibleDocumentIds(ids.userC);

    expect(accessible.has(ids.docC1)).toBe(true);
    expect(accessible.has(ids.docAdmin!)).toBe(false);
    expect(accessible.has(ids.docA1)).toBe(false);
  });

  // ============================================================
  // BOUNDARY: assertDocumentAccess (Actions 4a–4d).
  // ============================================================

  maybeIt('Action 4a — User B blocked from admin doc', async () => {
    ids = await seedShareTestGraph(graphDb!, db, {
      runSuffix: freshSuffix(),
      admin: { includeAdmin: true },
    });

    const ctx = buildCtx(ids.userB);

    await expect(assertDocumentAccess(ctx, [ids.docAdmin!])).rejects.toThrow(
      'One or more documents are not accessible',
    );
  });

  maybeIt('Action 4b — User B blocked from User A\'s personal doc', async () => {
    ids = await seedShareTestGraph(graphDb!, db, {
      runSuffix: freshSuffix(),
      admin: { includeAdmin: true },
    });

    const ctx = buildCtx(ids.userB);

    await expect(assertDocumentAccess(ctx, [ids.docA1])).rejects.toThrow(
      'One or more documents are not accessible',
    );
  });

  maybeIt('Action 4c — single-id form rejects (get-document-content shape)', async () => {
    ids = await seedShareTestGraph(graphDb!, db, {
      runSuffix: freshSuffix(),
      admin: { includeAdmin: true },
    });

    const ctx = buildCtx(ids.userB);

    // The single-id input is the path used by features/shared/routes/document-library/upload/get-document-content.ts.
    await expect(assertDocumentAccess(ctx, ids.docAdmin!)).rejects.toThrow(
      'One or more documents are not accessible',
    );
  });

  maybeIt('Action 4d — User B blocked from User C\'s personal doc (cross-tenant isolation)', async () => {
    ids = await seedShareTestGraph(graphDb!, db, {
      runSuffix: freshSuffix(),
      admin: { includeAdmin: true },
    });

    const ctx = buildCtx(ids.userB);

    await expect(assertDocumentAccess(ctx, [ids.docC1])).rejects.toThrow(
      'One or more documents are not accessible',
    );
  });

  maybeIt('User A passes the boundary for both own and admin-shared docs', async () => {
    ids = await seedShareTestGraph(graphDb!, db, {
      runSuffix: freshSuffix(),
      admin: { includeAdmin: true },
    });

    const ctx = buildCtx(ids.userA);

    // Returns the accessible set on success (not just void).
    const result = await assertDocumentAccess(ctx, [ids.docA1, ids.docAdmin!]);
    expect(result.has(ids.docA1)).toBe(true);
    expect(result.has(ids.docAdmin!)).toBe(true);
  });

  // ============================================================
  // DEFENSE-IN-DEPTH (Action 5b): DALs that take accessibleDocIds
  // must filter at the Cypher layer too, not just trust the boundary.
  // ============================================================

  maybeIt('Action 5b — getScopedGraphSchema excludes admin doc when accessibleDocIds excludes it', async () => {
    ids = await seedShareTestGraph(graphDb!, db, {
      runSuffix: freshSuffix(),
      admin: { includeAdmin: true },
    });

    // The seed plants ADMIN_ONLY_TYPE on one of D_admin's entities so that the
    // schema sample can be tested with a value that exists nowhere else.
    const accessibleWithoutAdmin = new Set([ids.docA1]) as unknown as AccessibleDocIds;
    const schema = await getScopedGraphSchema(accessibleWithoutAdmin, [ids.docAdmin!]);

    expect(schema).not.toContain('ADMIN_ONLY_TYPE');
  });

  maybeIt('Action 5b — getScopedGraphSchema includes admin doc when accessibleDocIds includes it', async () => {
    ids = await seedShareTestGraph(graphDb!, db, {
      runSuffix: freshSuffix(),
      admin: { includeAdmin: true },
    });

    const accessibleWithAdmin = new Set([ids.docAdmin!]) as unknown as AccessibleDocIds;
    const schema = await getScopedGraphSchema(accessibleWithAdmin, [ids.docAdmin!]);

    expect(schema).toContain('ADMIN_ONLY_TYPE');
  });

  maybeIt('Action 5b — getNodeNeighbors filters by documentId predicate at the Cypher layer', async () => {
    ids = await seedShareTestGraph(graphDb!, db, {
      runSuffix: freshSuffix(),
      admin: { includeAdmin: true },
    });

    // The first D_admin entity exists in the graph with a known internal Neo4j id.
    // Resolve it via the seeded UUID (Entity.id property — the application-level UUID, not neo internal id).
    const lookup = await graphDb!.run(
      'MATCH (e:Entity {id: $entityId}) RETURN id(e) AS neoId',
      { entityId: ids.docAdminEntities![0] },
    );
    expect(lookup.records.length).toBe(1);
    const neoIdValue = lookup.records[0].get('neoId');
    const adminEntityNeoId =
      typeof neoIdValue === 'number'
        ? neoIdValue
        : (neoIdValue as { toNumber: () => number }).toNumber();

    // Pass documentIds=[docA1] (which is what the route boundary would have allowed)
    // and assert the source-node lookup itself refuses to resolve the admin entity —
    // the Cypher filter (documentId IN $documentIds OR Document AND id IN $documentIds)
    // excludes it, so the DAL throws rather than silently expanding from a node the
    // caller shouldn't be able to see.
    await expect(
      getNodeNeighbors({
        documentIds: [ids.docA1],
        nodeNeoId: adminEntityNeoId,
      }),
    ).rejects.toThrow('Source node not found or not accessible');
  });

  // ============================================================
  // FOLLOW-UPS — these are intentionally NOT implemented in this
  // file. Each requires significant additional infrastructure that
  // the access-model invariants above do not depend on. Track as
  // separate tickets.
  // ============================================================

  it.todo(
    'Action 1a/1b/2a/2b/3 — full chat read-path orchestration. Requires SystemConfig + non-zero embedding fixture + AI mock. Best implemented as a focused chat-worker integration test, not bundled here.',
  );

  it.todo(
    'Action 5a — per-route Forbidden propagation across 8 graph routes. Already covered at unit level by features/chat/routes/graph-database/*.test.ts; integration-level coverage would duplicate.',
  );

  it.todo(
    'Action 6/7 — deletion → access lost. Tests pre-existing cascade behavior, not the new auth model. Worth adding as a regression guard but unblocks merge of this PR.',
  );

  it.todo(
    'Action 8 — workflow safety via processDocuments. Requires execute-workflow route wiring + AI mock. Seed already supports it (admin: { includeWorkflow: true }); only the test body is missing.',
  );

  it.todo(
    'Action 9 — build still owner-only. Tests build-graph route + verifyDocumentOwnership. Unchanged behavior; non-blocking.',
  );

  it.todo(
    'Action 10 — worker silent-fail-closed via processChatJob. Requires synthesizing ChatJobData, creating a Chat row + ChatMessage rows, mocking the AI source. Substantial setup; best as a dedicated worker integration test.',
  );
});
