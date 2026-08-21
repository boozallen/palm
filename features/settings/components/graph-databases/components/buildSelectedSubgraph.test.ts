import { buildSelectedSubgraph } from './buildSelectedSubgraph';

// numeric id = the edge-reference id; properties.id = the table-checkbox UUID.
const node = (id: number, uuid: string) => ({ id, properties: { id: uuid } });
const edge = (from: number, to: number, type = 'REL') => ({ from, to, type });

const graph = {
  nodes: [node(10, 'a'), node(20, 'b'), node(30, 'c')],
  edges: [edge(10, 20, 'AB'), edge(20, 30, 'BC')],
};

describe('buildSelectedSubgraph', () => {
  describe('evidence mode (edgeComplete = false) — selection is authoritative', () => {
    it('keeps only selected nodes and the edges strictly among them', () => {
      const { nodes, edges } = buildSelectedSubgraph(graph, ['a', 'b'], false);
      expect(nodes.map((n) => n.id).sort()).toEqual([10, 20]);
      // AB qualifies (both selected); BC drops (c not selected)
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({ from: 10, to: 20 });
    });

    it('does NOT re-add an unchecked node that shares an edge with a selected one', () => {
      // 'b' is unchecked; without edge-completion it must stay off even though a–b and b–c exist.
      const { nodes, edges } = buildSelectedSubgraph(graph, ['a', 'c'], false);
      expect(nodes.map((n) => n.id).sort()).toEqual([10, 30]);
      // No edge survives (each touches the unchecked 'b') — proves unchecking actually removes.
      expect(edges).toHaveLength(0);
    });

    it('deselecting one node removes it and its edges', () => {
      const all = buildSelectedSubgraph(graph, ['a', 'b', 'c'], false);
      expect(all.nodes).toHaveLength(3);
      expect(all.edges).toHaveLength(2);

      const fewer = buildSelectedSubgraph(graph, ['a', 'b'], false);
      expect(fewer.nodes.map((n) => n.id)).not.toContain(30);
      expect(fewer.edges).toHaveLength(1); // BC gone with c
    });
  });

  describe('enumeration mode (edgeComplete = true) — neighbors are pulled in', () => {
    // A clean pair so the contrast isolates the flag (the 3-node chain would cascade a→b→c,
    // an order-dependent quirk of the original logic that this helper preserves but doesn't pin).
    const pair = { nodes: [node(10, 'a'), node(20, 'b')], edges: [edge(10, 20, 'AB')] };

    it('re-adds the missing endpoint of an edge with one selected end so the edge renders', () => {
      const { nodes, edges } = buildSelectedSubgraph(pair, ['a'], true);
      expect(nodes.map((n) => n.id).sort((x, y) => x - y)).toEqual([10, 20]);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({ from: 10, to: 20 });
    });

    it('evidence mode leaves that endpoint out for the same input (the fix)', () => {
      const { nodes, edges } = buildSelectedSubgraph(pair, ['a'], false);
      expect(nodes.map((n) => n.id)).toEqual([10]);
      expect(edges).toHaveLength(0);
    });
  });

  it('returns empty when nothing is selected (both modes)', () => {
    expect(buildSelectedSubgraph(graph, [], false)).toEqual({ nodes: [], edges: [] });
    expect(buildSelectedSubgraph(graph, [], true)).toEqual({ nodes: [], edges: [] });
  });

  it('ignores selected UUIDs that match no node', () => {
    const { nodes, edges } = buildSelectedSubgraph(graph, ['a', 'does-not-exist'], false);
    expect(nodes.map((n) => n.id)).toEqual([10]);
    expect(edges).toHaveLength(0);
  });
});
