/**
 * Integration parity test for V2 resolution.
 *
 * Exercises the REAL blocking → cluster decision → confirmed-edge closure
 * pipeline end-to-end, mocking only the I/O boundaries (candidate search DAL,
 * identity-cluster DAL, and the LLM via an oracle that merges true duplicates
 * and rejects near-misses). Asserts:
 *  - true duplicates collapse to one IDENTITY equivalence class
 *  - a singleton produces no candidates / no edges / no LLM call
 *  - a parent/subsidiary near-miss is surfaced together but NOT merged (#65)
 *  - a large single-duplicate block resolves with ~linear (not quadratic) calls
 *  - a failed block LLM call is surfaced as `failedCalls`, not silently swallowed
 */
import { resolveEntitiesV2 } from '@/features/graph-database/services/resolveEntitiesV2';
import { searchCandidatesExact, type CandidateRow } from '@/features/graph-database/dal/candidateSearchExact';
import { getIdentityClusters } from '@/features/graph-database/dal/getIdentityClusters';
import * as identityClusterHubs from '@/features/graph-database/dal/identityClusterHubs';
import { UnionFind } from '@/features/graph-database/utils/unionFind';
import type { Entity, Resolution } from '@/features/graph-database/types';

jest.mock('@/features/graph-database/dal/candidateSearchExact');
jest.mock('@/features/graph-database/dal/getIdentityClusters');
jest.mock('@/features/graph-database/dal/identityClusterHubs');
jest.mock('@/features/ai-provider/factory');
jest.mock('@/server/db', () => ({ __esModule: true, default: { $queryRaw: jest.fn() } }));
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((s: TemplateStringsArray, ...v: unknown[]) => ({ s, v })),
    raw: jest.fn((x: string) => x),
    empty: Symbol('empty'),
  },
}));
jest.mock('@/server/logger');

const mockSearch = searchCandidatesExact as jest.MockedFunction<typeof searchCandidatesExact>;
const mockGetClusters = getIdentityClusters as jest.MockedFunction<typeof getIdentityClusters>;
const mockGetHubIdsForMembers = identityClusterHubs.getHubIdsForMembers as jest.MockedFunction<
  typeof identityClusterHubs.getHubIdsForMembers
>;
const mockCreateCluster = identityClusterHubs.createCluster as jest.MockedFunction<
  typeof identityClusterHubs.createCluster
>;
const mockAttachToCluster = identityClusterHubs.attachToCluster as jest.MockedFunction<
  typeof identityClusterHubs.attachToCluster
>;
const mockMergeClusters = identityClusterHubs.mergeClusters as jest.MockedFunction<
  typeof identityClusterHubs.mergeClusters
>;

function entity(id: string, name: string, documentId: string, mentionCount = 1): Entity {
  return {
    id,
    name,
    type: 'ORGANIZATION',
    normalizedName: name.toLowerCase().trim(),
    description: `desc ${name}`,
    aliases: [],
    documentId,
    mentionCount,
    firstSeenAt: new Date('2024-01-01'),
  };
}

/** Normalize a name to its real-world identity key (strip punctuation/space). */
function identityKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** LLM oracle: merges nodes that share an identity key; separates the rest. */
function oracleCompletion() {
  return jest.fn(async (prompt: string) => {
    const nodes: Array<{ id: string; name: string }> = [];
    const re = /\[id: ([^\]]+)\]\s*\n\*\*Node: "([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(prompt)) !== null) {
      nodes.push({ id: m[1], name: m[2] });
    }

    if (/ANCHOR:/.test(prompt)) {
      const anchor = nodes[0];
      const matches = nodes
        .slice(1)
        .filter((c) => identityKey(c.name) === identityKey(anchor.name))
        .map((c) => ({ id: c.id, type: 'IDENTITY', confidence: 0.95, rationale: 'same' }));
      return { text: JSON.stringify({ matches }) };
    }

    const byKey = new Map<string, string[]>();
    for (const n of nodes) {
      const k = identityKey(n.name);
      (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(n.id);
    }
    const groups = [...byKey.values()].map((members) => ({
      members,
      confidence: 0.95,
      rationale: 'same',
    }));
    return { text: JSON.stringify({ groups }) };
  });
}

function installOracle(completion: jest.Mock) {
  const { AIFactory } = require('@/features/ai-provider/factory');
  AIFactory.mockImplementation(() => ({
    buildKnowledgeGraphSource: jest.fn().mockResolvedValue({
      source: { completion },
      model: { externalId: 'test-model' },
    }),
  }));
}

function toRow(other: Entity, similarity: number): CandidateRow {
  return {
    id: other.id,
    name: other.name,
    type: other.type,
    normalizedName: other.normalizedName,
    description: other.description,
    aliases: other.aliases,
    documentId: other.documentId,
    similarity,
  };
}

function identityClasses(resolutions: Resolution[]): string[][] {
  const uf = new UnionFind<string>();
  for (const r of resolutions) {
    if (r.edgeType === 'IDENTITY') {
      uf.union(r.entity1.id, r.entity2.id);
    }
  }
  return uf.groups();
}

describe('resolveEntitiesV2 — integration parity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClusters.mockResolvedValue([]); // fresh build, no existing clusters
    mockGetHubIdsForMembers.mockResolvedValue(new Map()); // no pre-existing hubs
    mockCreateCluster.mockResolvedValue('hub-generated');
    mockAttachToCluster.mockResolvedValue(undefined);
    mockMergeClusters.mockResolvedValue(undefined);
  });

  it('collapses true duplicates, isolates a singleton, and does not merge a subsidiary', async () => {
    const ibm1 = entity('ibm1', 'IBM', 'doc1', 5);
    const ibm2 = entity('ibm2', 'IBM', 'doc2', 3);
    const ibm3 = entity('ibm3', 'I.B.M.', 'doc3', 2);
    const widget = entity('widget', 'Widgets Inc', 'doc1'); // singleton
    const acme = entity('acme', 'Acme Corp', 'doc1', 4);
    const acmeRobotics = entity('acmeRobotics', 'Acme Robotics', 'doc2', 1); // subsidiary
    const all = [ibm1, ibm2, ibm3, widget, acme, acmeRobotics];
    const byId = new Map(all.map((e) => [e.id, e]));

    const subsidiaryPair = new Set(['acme|acmeRobotics']);
    const simOf = (a: Entity, b: Entity): number => {
      if (subsidiaryPair.has([a.id, b.id].sort().join('|'))) {
        return 0.96; // near-miss
      }
      if (identityKey(a.name) === identityKey(b.name)) {
        return 0.97;
      }
      return 0.3;
    };

    mockSearch.mockImplementation(async (source) => {
      const src = byId.get(source.id)!;
      return all
        .filter((o) => o.id !== src.id)
        .map((o) => toRow(o, simOf(src, o)));
    });

    const completion = oracleCompletion();
    installOracle(completion);

    const { resolutions, failedCalls } = await resolveEntitiesV2({
      newNodes: all,
      existingNodes: [],
      userId: 'user-1',
      scope: 'user',
    });

    // 0. A clean run reports no undecided blocks — the gate must not trip.
    expect(failedCalls).toBe(0);

    // 1. IBM trio is one IDENTITY equivalence class.
    const classes = identityClasses(resolutions);
    const ibmClass = classes.find((c) => c.includes('ibm1'));
    expect(ibmClass).toBeDefined();
    expect([...ibmClass!].sort()).toEqual(['ibm1', 'ibm2', 'ibm3']);

    // 2. Singleton is in no edge at all.
    expect(resolutions.some((r) => r.entity1.id === 'widget' || r.entity2.id === 'widget')).toBe(false);

    // 3. Subsidiary is NOT merged into its parent (no IDENTITY edge between them)...
    const acmeIdentity = resolutions.some(
      (r) =>
        r.edgeType === 'IDENTITY' &&
        [r.entity1.id, r.entity2.id].sort().join('|') === 'acme|acmeRobotics'
    );
    expect(acmeIdentity).toBe(false);

    // ...but they WERE surfaced together to the LLM (same partition prompt).
    const surfacedTogether = completion.mock.calls.some(
      ([prompt]) => /Acme Corp/.test(prompt) && /Acme Robotics/.test(prompt)
    );
    expect(surfacedTogether).toBe(true);
  });

  it('resolves a 1000-node single-duplicate block with ~linear LLM calls', async () => {
    const N = 1000;
    const nodes = Array.from({ length: N }, (_, i) =>
      entity(`n${String(i).padStart(4, '0')}`, 'IBM', `doc${i}`)
    );
    const indexById = new Map(nodes.map((n, i) => [n.id, i]));

    // Chain topology: each node neighbors its index ±1 at high similarity. The
    // whole chain is one connected (equal-weight) component → one block.
    mockSearch.mockImplementation(async (source) => {
      const i = indexById.get(source.id)!;
      const rows: CandidateRow[] = [];
      if (i > 0) {
        rows.push(toRow(nodes[i - 1], 0.97));
      }
      if (i < N - 1) {
        rows.push(toRow(nodes[i + 1], 0.97));
      }
      return rows;
    });

    const completion = oracleCompletion();
    installOracle(completion);

    const { resolutions } = await resolveEntitiesV2({
      newNodes: nodes,
      existingNodes: [],
      userId: 'user-1',
      scope: 'user',
    });

    // Recovered as ONE cluster of all 1000 nodes.
    const classes = identityClasses(resolutions);
    const big = classes.find((c) => c.length > 1);
    expect(big).toBeDefined();
    expect(big!.length).toBe(N);

    // Linear, not quadratic: anchorBatchSize=20 → ~ceil(999/20)=50 calls.
    // Quadratic would be on the order of N*N/2 = 500,000.
    expect(completion.mock.calls.length).toBeLessThanOrEqual(2 * Math.ceil(N / 20) + 4);
    expect(completion.mock.calls.length).toBeLessThan(N);
  });

  it('adds one node to a large existing cluster with O(1) LLM calls (representative collapse)', async () => {
    const N = 500;
    const existing = Array.from({ length: N }, (_, i) => entity(`ibm-existing-${i}`, 'IBM', `doc${i}`));
    const newNode = entity('ibm-new', 'IBM', 'doc-new');

    // One frozen hub containing all 500 prior duplicates.
    mockGetClusters.mockResolvedValue([{ representativeId: 'hub-1', memberIds: existing.map((e) => e.id) }]);

    // Mirrors the real unbounded search (candidateSearchExact.ts has no LIMIT):
    // the new node's search surfaces every prior duplicate as a candidate.
    mockSearch.mockImplementation(async (source) => {
      if (source.id !== newNode.id) {
        return [];
      }
      return existing.map((e) => toRow(e, 0.97));
    });

    const completion = oracleCompletion();
    installOracle(completion);

    const { resolutions } = await resolveEntitiesV2({
      newNodes: [newNode],
      existingNodes: existing,
      userId: 'user-1',
      scope: 'user',
    });

    // LOAD-BEARING: without collapse, the new node's degree-500 star is
    // exactly what removeHubs prunes (a degree-1% outlier) — the pass would
    // emit NOTHING at all (Problem 2, the headline hub-pruning bug). With
    // collapse, the new node's candidate-graph degree drops to ~1.
    const identityEdges = resolutions.filter((r) => r.edgeType === 'IDENTITY');
    expect(identityEdges).toHaveLength(1);

    const ids = [identityEdges[0].entity1.id, identityEdges[0].entity2.id];
    expect(ids).toContain(newNode.id);
    const representativeId = ids.find((id) => id !== newNode.id)!;
    // The representative id must be a REAL cluster member — never synthesised.
    expect(existing.some((e) => e.id === representativeId)).toBe(true);

    // Constant, bounded LLM calls — collapse guarantees a 2-node prompt no
    // matter how large the cluster is. (Secondary: call count was already
    // roughly flat pre-collapse; what collapse guarantees is that it stays
    // flat BY CONSTRUCTION.)
    expect(completion.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('surfaces failed block LLM calls instead of reporting them as zero resolutions', async () => {
    // A real duplicate pair, so a block forms and an LLM call IS attempted...
    const ibm1 = entity('ibm1', 'IBM', 'doc1', 5);
    const ibm2 = entity('ibm2', 'IBM', 'doc2', 3);
    const byId = new Map([ibm1, ibm2].map((e) => [e.id, e]));

    mockSearch.mockImplementation(async (source) => {
      const src = byId.get(source.id)!;
      return [ibm1, ibm2].filter((o) => o.id !== src.id).map((o) => toRow(o, 0.97));
    });

    // ...but the call permanently fails (plain Error = non-retryable, so
    // retryWithBackoff rethrows immediately rather than sleeping through retries).
    const completion = jest.fn().mockRejectedValue(new Error('bedrock unavailable'));
    installOracle(completion);

    const { resolutions, failedCalls } = await resolveEntitiesV2({
      newNodes: [ibm1, ibm2],
      existingNodes: [],
      userId: 'user-1',
      scope: 'user',
    });

    expect(completion).toHaveBeenCalled();
    // The duplicate is left UNDECIDED — indistinguishable from "nothing to merge"
    // by edge count alone, which is exactly why failedCalls has to be reported.
    expect(resolutions).toEqual([]);
    expect(failedCalls).toBeGreaterThan(0);
  });

  it('shouldCancel breaks the block loop between blocks without inflating failedCalls', async () => {
    // Two disjoint duplicate pairs — no cross-group candidate edges — so
    // blocking forms exactly two independent blocks.
    const ibm1 = entity('ibm1', 'IBM', 'doc1');
    const ibm2 = entity('ibm2', 'IBM', 'doc2');
    const widget1 = entity('widget1', 'Widgets Inc', 'doc3');
    const widget2 = entity('widget2', 'Widgets Inc', 'doc4');
    const groupOf = (id: string) => (id.startsWith('ibm') ? 'ibm' : 'widget');

    mockSearch.mockImplementation(async (source) => {
      return [ibm1, ibm2, widget1, widget2]
        .filter((o) => o.id !== source.id && groupOf(o.id) === groupOf(source.id))
        .map((o) => toRow(o, 0.97));
    });

    const completion = oracleCompletion();
    installOracle(completion);

    const shouldCancel = jest.fn()
      .mockResolvedValueOnce(false) // checked before block 1 — proceed
      .mockResolvedValueOnce(true); // checked before block 2 — stop

    const { resolutions, failedCalls } = await resolveEntitiesV2({
      newNodes: [ibm1, ibm2, widget1, widget2],
      existingNodes: [],
      userId: 'user-1',
      scope: 'user',
      shouldCancel,
    });

    expect(shouldCancel).toHaveBeenCalledTimes(2);
    // Exactly one block's worth of decisions persisted; the other was skipped
    // (not counted as a failure).
    const identityEdges = resolutions.filter((r) => r.edgeType === 'IDENTITY');
    expect(identityEdges).toHaveLength(1);
    expect(failedCalls).toBe(0);
  });
});
