import { mergeBaseWithInteractive } from './graphMergeUtils';

const node = (id: number, label: string, isInteractive = false) => ({
  id, label, ...(isInteractive ? { isInteractive: true } : {}),
});

const edge = (from: number, to: number, type: string, isInteractive = false) => ({
  from, to, type, ...(isInteractive ? { isInteractive: true } : {}),
});

describe('mergeBaseWithInteractive', () => {
  it('returns base data when no interactive nodes exist', () => {
    const prev = { nodes: [node(1, 'A')], edges: [] };
    const base = { nodes: [node(1, 'A'), node(2, 'B')], edges: [edge(1, 2, 'RELATED')] };

    const result = mergeBaseWithInteractive(prev, base, new Set());

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('preserves interactive nodes during base rebuild', () => {
    const prev = {
      nodes: [node(1, 'A'), node(2, 'B'), node(3, 'C-expanded', true)],
      edges: [edge(1, 2, 'RELATED'), edge(2, 3, 'MENTIONS', true)],
    };
    const base = {
      nodes: [node(1, 'A'), node(2, 'B')],
      edges: [edge(1, 2, 'RELATED')],
    };

    const result = mergeBaseWithInteractive(prev, base, new Set());

    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.find(n => n.id === 3)?.label).toBe('C-expanded');
    expect(result.edges).toHaveLength(2);
  });

  it('excludes removed interactive nodes', () => {
    const prev = {
      nodes: [node(1, 'A'), node(3, 'C-expanded', true), node(4, 'D-expanded', true)],
      edges: [edge(1, 3, 'RELATED', true), edge(1, 4, 'RELATED', true)],
    };
    const base = {
      nodes: [node(1, 'A')],
      edges: [],
    };
    const removedIds = new Set([3]);

    const result = mergeBaseWithInteractive(prev, base, removedIds);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map(n => n.id)).toEqual([1, 4]);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].to).toBe(4);
  });

  it('base node takes precedence over interactive node with same ID', () => {
    const prev = {
      nodes: [node(1, 'A-interactive', true)],
      edges: [],
    };
    const base = {
      nodes: [node(1, 'A-base')],
      edges: [],
    };

    const result = mergeBaseWithInteractive(prev, base, new Set());

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].label).toBe('A-base');
  });

  it('drops interactive edges when their target node is removed', () => {
    const prev = {
      nodes: [node(1, 'A'), node(3, 'C', true)],
      edges: [edge(1, 3, 'MENTIONS', true)],
    };
    const base = {
      nodes: [node(1, 'A'), node(2, 'B')],
      edges: [edge(1, 2, 'RELATED')],
    };
    const removedIds = new Set([3]);

    const result = mergeBaseWithInteractive(prev, base, removedIds);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].type).toBe('RELATED');
  });

  it('drops interactive edges whose endpoints are not in merged node set', () => {
    const prev = {
      nodes: [node(5, 'E', true), node(6, 'F', true)],
      edges: [edge(5, 6, 'CONNECTS', true)],
    };
    // Base has neither node 5 nor 6, and node 5 was removed
    const base = {
      nodes: [node(1, 'A')],
      edges: [],
    };
    const removedIds = new Set([5]);

    const result = mergeBaseWithInteractive(prev, base, removedIds);

    // Node 6 survives (interactive, not removed), but edge 5->6 is dropped (node 5 removed)
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map(n => n.id)).toEqual([1, 6]);
    expect(result.edges).toHaveLength(0);
  });

  it('deduplicates edges — base edge takes precedence over interactive', () => {
    const prev = {
      nodes: [node(1, 'A'), node(2, 'B')],
      edges: [edge(1, 2, 'RELATED', true)],
    };
    const base = {
      nodes: [node(1, 'A'), node(2, 'B')],
      edges: [edge(1, 2, 'RELATED')],
    };

    const result = mergeBaseWithInteractive(prev, base, new Set());

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].isInteractive).toBeUndefined();
  });

  it('handles empty previous state', () => {
    const prev = { nodes: [], edges: [] };
    const base = {
      nodes: [node(1, 'A'), node(2, 'B')],
      edges: [edge(1, 2, 'RELATED')],
    };

    const result = mergeBaseWithInteractive(prev, base, new Set());

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('handles empty base data — only interactive nodes remain', () => {
    const prev = {
      nodes: [node(3, 'C', true), node(4, 'D', true)],
      edges: [edge(3, 4, 'CONNECTS', true)],
    };
    const base = { nodes: [], edges: [] };

    const result = mergeBaseWithInteractive(prev, base, new Set());

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('preserves interactive nodes across table selection changes', () => {
    // Simulates: user has 3 base nodes selected, expands one, then changes table selection
    const prev = {
      nodes: [node(1, 'A'), node(2, 'B'), node(3, 'C'), node(4, 'D-neighbor', true)],
      edges: [edge(1, 2, 'RELATED'), edge(3, 4, 'MENTIONS', true)],
    };
    // New base: user deselected node 2 from table
    const base = {
      nodes: [node(1, 'A'), node(3, 'C')],
      edges: [],
    };

    const result = mergeBaseWithInteractive(prev, base, new Set());

    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.map(n => n.id).sort()).toEqual([1, 3, 4]);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].type).toBe('MENTIONS');
  });
});
