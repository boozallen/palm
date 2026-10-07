import {
  buildCandidateGraph,
  applyMutualKnn,
  removeHubs,
  formBlocks,
  splitOversizedBlocks,
  quantile,
  type CandidateEdge,
} from '@/features/graph-database/services/blocking';

jest.mock('@/server/logger');

describe('blocking', () => {
  describe('buildCandidateGraph', () => {
    it('builds an undirected graph and dedupes reciprocal edges', () => {
      const edges: CandidateEdge[] = [
        { a: 'x', b: 'y', similarity: 0.9 },
        { a: 'y', b: 'x', similarity: 0.85 },
      ];
      const g = buildCandidateGraph(edges);
      expect(g.get('x')?.get('y')).toBe(0.9); // keeps strongest
      expect(g.get('y')?.get('x')).toBe(0.9);
    });

    it('drops self-loops', () => {
      const g = buildCandidateGraph([{ a: 'x', b: 'x', similarity: 1 }]);
      expect(g.has('x')).toBe(false);
    });
  });

  describe('formBlocks', () => {
    it('returns connected components, isolated nodes as size-1 blocks', () => {
      const g = buildCandidateGraph([
        { a: 'a', b: 'b', similarity: 0.9 },
        { a: 'b', b: 'c', similarity: 0.9 },
      ]);
      g.set('lonely', new Map());

      const blocks = formBlocks(g);
      const sizes = blocks.map((b) => b.length).sort();
      expect(sizes).toEqual([1, 3]);
    });
  });

  describe('applyMutualKnn', () => {
    it('splits a chain when a hop is not reciprocal between two origins', () => {
      // A-B-C chain; C is an origin whose neighbor set omits B, and B omits C.
      const g = buildCandidateGraph([
        { a: 'A', b: 'B', similarity: 0.9 },
        { a: 'B', b: 'C', similarity: 0.82 },
      ]);
      const originNeighbors = new Map<string, Set<string>>([
        ['A', new Set(['B'])],
        ['B', new Set(['A'])], // B does NOT list C
        ['C', new Set(['B'])], // C lists B, but B doesn't list C → not mutual
      ]);

      const pruned = applyMutualKnn(g, originNeighbors);
      const blocks = formBlocks(pruned).map((b) => b.sort());
      // A-B stays; C splits off
      const sizes = blocks.map((b) => b.length).sort();
      expect(sizes).toEqual([1, 2]);
    });

    it('keeps edges where one endpoint never originated a search (new↔existing)', () => {
      const g = buildCandidateGraph([{ a: 'new1', b: 'existing1', similarity: 0.84 }]);
      const originNeighbors = new Map<string, Set<string>>([
        ['new1', new Set(['existing1'])],
        // existing1 is not an origin
      ]);
      const pruned = applyMutualKnn(g, originNeighbors);
      expect(formBlocks(pruned)).toHaveLength(1);
      expect(formBlocks(pruned)[0].sort()).toEqual(['existing1', 'new1']);
    });
  });

  describe('removeHubs', () => {
    it('removes a hub so its star does not swallow the graph into one block', () => {
      // Star: hub connected to 4 leaves; leaves otherwise unrelated.
      const g = buildCandidateGraph([
        { a: 'hub', b: 'l1', similarity: 0.81 },
        { a: 'hub', b: 'l2', similarity: 0.81 },
        { a: 'hub', b: 'l3', similarity: 0.81 },
        { a: 'hub', b: 'l4', similarity: 0.81 },
      ]);

      const { graph, removed } = removeHubs(g, {
        degreePercentile: 0.5, // hub degree (4) >> leaves (1) → hub removed
        genericNames: new Set(),
        normalizedNameById: new Map(),
      });

      expect(removed).toContain('hub');
      const blocks = formBlocks(graph);
      // Without the hub, the 4 leaves are isolated singletons
      expect(blocks.map((b) => b.length).sort()).toEqual([1, 1, 1, 1]);
    });

    it('removes generic-term nodes regardless of degree', () => {
      const g = buildCandidateGraph([{ a: 'orgA', b: 'the company', similarity: 0.85 }]);
      const { removed } = removeHubs(g, {
        degreePercentile: 0.99,
        genericNames: new Set(['the company']),
        normalizedNameById: new Map([
          ['orgA', 'org a'],
          ['the company', 'the company'],
        ]),
      });
      expect(removed).toEqual(['the company']);
    });
  });

  describe('splitOversizedBlocks', () => {
    it('splits an oversized block along its weakest edges', () => {
      // Two tight triples joined by one weak bridge edge.
      const edges: CandidateEdge[] = [
        { a: 'p1', b: 'p2', similarity: 0.97 },
        { a: 'p2', b: 'p3', similarity: 0.96 },
        { a: 'p1', b: 'p3', similarity: 0.95 },
        { a: 'q1', b: 'q2', similarity: 0.97 },
        { a: 'q2', b: 'q3', similarity: 0.96 },
        { a: 'q1', b: 'q3', similarity: 0.95 },
        { a: 'p3', b: 'q1', similarity: 0.81 }, // weak bridge
      ];
      const g = buildCandidateGraph(edges);
      const blocks = formBlocks(g);
      expect(blocks).toHaveLength(1); // single linkage joins everything

      const split = splitOversizedBlocks(blocks, g, { maxBlockSize: 3 });
      expect(split.length).toBeGreaterThanOrEqual(2);
      // Each resulting block is within the cap
      expect(split.every((b) => b.length <= 3)).toBe(true);
    });

    it('keeps blocks already within the cap untouched', () => {
      const g = buildCandidateGraph([{ a: 'a', b: 'b', similarity: 0.9 }]);
      const blocks = formBlocks(g);
      const split = splitOversizedBlocks(blocks, g, { maxBlockSize: 30 });
      expect(split).toEqual(blocks);
    });

    it('keeps an unsplittable equal-weight clique rather than dropping it', () => {
      // 4-clique all equal weight; thresholding cannot separate it.
      const edges: CandidateEdge[] = [
        { a: 'a', b: 'b', similarity: 0.9 },
        { a: 'a', b: 'c', similarity: 0.9 },
        { a: 'a', b: 'd', similarity: 0.9 },
        { a: 'b', b: 'c', similarity: 0.9 },
        { a: 'b', b: 'd', similarity: 0.9 },
        { a: 'c', b: 'd', similarity: 0.9 },
      ];
      const g = buildCandidateGraph(edges);
      const split = splitOversizedBlocks(formBlocks(g), g, { maxBlockSize: 2 });
      // Cannot reduce → the 4 nodes are preserved (not lost)
      const allNodes = split.flat().sort();
      expect(allNodes).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('quantile', () => {
    it('computes interpolated quantiles', () => {
      expect(quantile([1, 2, 3, 4], 0)).toBe(1);
      expect(quantile([1, 2, 3, 4], 1)).toBe(4);
      expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5);
    });
    it('handles empty and singleton inputs', () => {
      expect(quantile([], 0.5)).toBe(0);
      expect(quantile([7], 0.9)).toBe(7);
    });
  });
});
