import { resolveBlock, type ResolveBlockContext } from '@/features/graph-database/services/clusterResolution';
import type { Entity } from '@/features/graph-database/types';
import type { IdentityCluster } from '@/features/graph-database/dal/getIdentityClusters';
import type { KnnGraph } from '@/features/graph-database/services/blocking';

// Use the REAL policy matcher (entity-entity allows IDENTITY + RELATED_RESOLUTION,
// disallows SIMILAR) so edge-type validation is exercised honestly.
jest.mock('@/server/logger');

function makeEntity(id: string, mentionCount = 1): Entity {
  return {
    id,
    name: id,
    type: 'ORGANIZATION',
    normalizedName: id.toLowerCase(),
    description: `desc ${id}`,
    aliases: [],
    documentId: `doc-${id}`,
    mentionCount,
    firstSeenAt: new Date('2024-01-01'),
  };
}

function baseCtx(
  nodes: Entity[],
  completion: jest.Mock,
  overrides: Partial<ResolveBlockContext> = {}
): ResolveBlockContext {
  return {
    nodeById: new Map(nodes.map((n) => [n.id, n])),
    graph: new Map() as KnnGraph,
    newNodeIds: new Set(nodes.map((n) => n.id)),
    frozenClusterByMember: new Map<string, IdentityCluster>(),
    isConcept: false,
    aiProvider: { completion },
    model: { externalId: 'test-model' },
    resolutionFailures: { count: 0 },
    ...overrides,
  };
}

describe('resolveBlock', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns no edges and makes no LLM call for a singleton block', async () => {
    const completion = jest.fn();
    const nodes = [makeEntity('e1')];
    const res = await resolveBlock(['e1'], baseCtx(nodes, completion));
    expect(res).toEqual([]);
    expect(completion).not.toHaveBeenCalled();
  });

  it('makes no LLM call for a multi-node block with no new node (no-new-node invariant guard)', async () => {
    const completion = jest.fn().mockResolvedValue({
      text: JSON.stringify({ groups: [{ members: ['x1', 'x2'], confidence: 0.9, rationale: 'same' }] }),
    });
    const nodes = [makeEntity('x1'), makeEntity('x2'), makeEntity('x3')];
    const ctx = baseCtx(nodes, completion, { newNodeIds: new Set() }); // all existing
    const res = await resolveBlock(['x1', 'x2', 'x3'], ctx);
    expect(res).toEqual([]);
    expect(completion).not.toHaveBeenCalled();
  });

  describe('partition path (small block)', () => {
    it('emits an IDENTITY star for a same-entity group, nothing for singletons', async () => {
      const completion = jest.fn().mockResolvedValue({
        text: JSON.stringify({
          groups: [
            { members: ['e1', 'e2'], confidence: 0.95, rationale: 'same org' },
            { members: ['e3'], confidence: 0.9, rationale: 'distinct' },
          ],
        }),
      });
      const nodes = [makeEntity('e1', 5), makeEntity('e2', 3), makeEntity('e3', 2)];
      const res = await resolveBlock(['e1', 'e2', 'e3'], baseCtx(nodes, completion));

      expect(completion).toHaveBeenCalledTimes(1);
      expect(res).toHaveLength(1);
      expect(res[0].edgeType).toBe('IDENTITY');
      expect(res[0].decidedBy).toBe('llm');
      const ids = [res[0].entity1.id, res[0].entity2.id].sort();
      expect(ids).toEqual(['e1', 'e2']);
    });

    it('emits an allowed non-identity relation between distinct nodes', async () => {
      const completion = jest.fn().mockResolvedValue({
        text: JSON.stringify({
          groups: [{ members: ['e1'] }, { members: ['e2'] }],
          relations: [
            { from: 'e1', to: 'e2', type: 'RELATED_RESOLUTION', confidence: 0.7, rationale: 'subsidiary' },
          ],
        }),
      });
      const nodes = [makeEntity('e1'), makeEntity('e2')];
      const res = await resolveBlock(['e1', 'e2'], baseCtx(nodes, completion));
      expect(res).toHaveLength(1);
      expect(res[0].edgeType).toBe('RELATED_RESOLUTION');
    });

    it('drops a relation whose edge type is disallowed by policy (SIMILAR for entities)', async () => {
      const completion = jest.fn().mockResolvedValue({
        text: JSON.stringify({
          groups: [{ members: ['e1'] }, { members: ['e2'] }],
          relations: [{ from: 'e1', to: 'e2', type: 'SIMILAR', confidence: 0.8, rationale: 'x' }],
        }),
      });
      const nodes = [makeEntity('e1'), makeEntity('e2')];
      const res = await resolveBlock(['e1', 'e2'], baseCtx(nodes, completion));
      expect(res).toHaveLength(0);
    });

    it('never re-judges an all-existing group (no new member)', async () => {
      const completion = jest.fn().mockResolvedValue({
        text: JSON.stringify({
          groups: [{ members: ['x1', 'x2'], confidence: 0.9, rationale: 'same' }],
        }),
      });
      const nodes = [makeEntity('x1'), makeEntity('x2')];
      const ctx = baseCtx(nodes, completion, { newNodeIds: new Set() }); // both existing
      const res = await resolveBlock(['x1', 'x2'], ctx);
      expect(res).toHaveLength(0);
      // The no-new-node invariant guard skips the LLM call entirely.
      expect(completion).not.toHaveBeenCalled();
    });
  });

  describe('anchor path (large block)', () => {
    it('resolves a single-cluster block with ~linear (not quadratic) LLM calls', async () => {
      // 50 nodes, all the same entity. Mock: every candidate in the batch is IDENTITY.
      const completion = jest.fn().mockImplementation((prompt: string) => {
        const ids = [...prompt.matchAll(/\[id: ([^\]]+)\]/g)].map((m) => m[1]);
        const candidateIds = ids.slice(1); // first id is the anchor
        return Promise.resolve({
          text: JSON.stringify({
            matches: candidateIds.map((id) => ({
              id,
              type: 'IDENTITY',
              confidence: 0.95,
              rationale: 'same',
            })),
          }),
        });
      });

      const nodes = Array.from({ length: 50 }, (_, i) => makeEntity(`n${String(i).padStart(2, '0')}`));
      const block = nodes.map((n) => n.id);
      const res = await resolveBlock(block, baseCtx(nodes, completion));

      // anchorBatchSize=20 → ceil(49/20)=3 calls for the first (all-matching) anchor.
      expect(completion).toHaveBeenCalledTimes(3);
      // Anchor links to all 49 others; quadratic would be ~50*49/2 = 1225.
      expect(res).toHaveLength(49);
      expect(res.every((r) => r.edgeType === 'IDENTITY')).toBe(true);
      // Linear bound: well under the quadratic floor.
      expect(completion.mock.calls.length).toBeLessThan(nodes.length);
    });

    it('terminates and bounds calls on a fully-distinct large block', async () => {
      // Mock: nothing ever matches the anchor.
      const completion = jest.fn().mockResolvedValue({ text: JSON.stringify({ matches: [] }) });
      const nodes = Array.from({ length: 40 }, (_, i) => makeEntity(`d${String(i).padStart(2, '0')}`));
      const res = await resolveBlock(nodes.map((n) => n.id), baseCtx(nodes, completion));

      expect(res).toHaveLength(0);
      // callBudget = 2*ceil(40/20)+4 = 8 → bounded, never quadratic.
      expect(completion.mock.calls.length).toBeLessThanOrEqual(8);
    });
  });

  describe('LLM failure accounting', () => {
    it('counts a permanently-failed LLM call as an undecided block, emitting no edge', async () => {
      // A plain Error is non-retryable, so retryWithBackoff rethrows immediately
      // (no real backoff) — the same terminal state as exhausted retries.
      const completion = jest.fn().mockRejectedValue(new Error('boom'));
      const nodes = [makeEntity('e1'), makeEntity('e2')];
      const resolutionFailures = { count: 0 };
      const res = await resolveBlock(['e1', 'e2'], baseCtx(nodes, completion, { resolutionFailures }));

      expect(res).toEqual([]);
      expect(resolutionFailures.count).toBe(1);
    });

    it('does not count the anchor call-budget truncation as a failure', async () => {
      // Every call SUCCEEDS; the block is simply all-distinct, so the deliberate
      // per-block call cap truncates it. That is a cap, not an LLM failure.
      const completion = jest.fn().mockResolvedValue({ text: JSON.stringify({ matches: [] }) });
      const nodes = Array.from({ length: 40 }, (_, i) => makeEntity(`d${String(i).padStart(2, '0')}`));
      const resolutionFailures = { count: 0 };
      await resolveBlock(nodes.map((n) => n.id), baseCtx(nodes, completion, { resolutionFailures }));

      expect(completion).toHaveBeenCalled();
      expect(resolutionFailures.count).toBe(0);
    });
  });
});
