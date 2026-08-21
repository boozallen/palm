import {
  extractGraphCitationsFromMessage,
  resolveCitationHandle,
  resolveCitationTarget,
  relationshipTypeMatches,
  handleResolvesOnGraph,
  filterHandlesToGraph,
  type HandleMap,
  type CitationGraph,
} from './graphCitationHelpers';

const handleMap: HandleMap = {
  E1: 'node-1',
  E2: 'node-2',
  R1: { src: 'node-1', relType: 'AGENCY_FIT', tgt: 'node-2' },
  Q0: 0,
  Q1: 1,
};

describe('extractGraphCitationsFromMessage', () => {
  it('resolves [[E#]] handles to node ids and strips the markers', () => {
    const { citedNodeIds, citedEdges, cleanedText } = extractGraphCitationsFromMessage(
      'Foo [[E1]] relates to bar [[E2]].',
      handleMap,
    );
    expect(citedNodeIds).toEqual(['node-1', 'node-2']);
    expect(citedEdges).toEqual([]);
    expect(cleanedText).toBe('Foo relates to bar.');
  });

  it('resolves [[R#]] to its triple and adds BOTH endpoints to citedNodeIds', () => {
    const { citedNodeIds, citedEdges } = extractGraphCitationsFromMessage(
      'They are linked via agency fit [[R1]].',
      handleMap,
    );
    expect(citedEdges).toEqual([{ src: 'node-1', relType: 'AGENCY_FIT', tgt: 'node-2' }]);
    // an edge implies its endpoints — they must render as nodes even if not cited as [[E#]]
    expect(citedNodeIds).toEqual(expect.arrayContaining(['node-1', 'node-2']));
    expect(citedNodeIds).toHaveLength(2);
  });

  it('keeps the span text in cleanedText while still resolving the handle to its node id', () => {
    const { citedNodeIds, citedEdges, cleanedText } = extractGraphCitationsFromMessage(
      'The vendor [[E1:Acme Corp]] supplies [[E2:Beta LLC]].',
      handleMap,
    );
    // Group 1 (the handle) still drives extraction — the span is render-only.
    expect(citedNodeIds).toEqual(['node-1', 'node-2']);
    expect(citedEdges).toEqual([]);
    // The persisted/displayed answer keeps the entity names so it reads naturally.
    expect(cleanedText).toBe('The vendor Acme Corp supplies Beta LLC.');
  });

  it('drops a handle-only marker from cleanedText (no span → today’s behavior)', () => {
    const { citedNodeIds, cleanedText } = extractGraphCitationsFromMessage(
      'The vendor [[E1]] supplies parts.',
      handleMap,
    );
    expect(citedNodeIds).toEqual(['node-1']);
    expect(cleanedText).toBe('The vendor supplies parts.');
  });

  it('leaves [[R#]] unaffected by the optional-span grammar', () => {
    const { citedEdges, cleanedText } = extractGraphCitationsFromMessage(
      'They are linked via agency fit [[R1]].',
      handleMap,
    );
    expect(citedEdges).toEqual([{ src: 'node-1', relType: 'AGENCY_FIT', tgt: 'node-2' }]);
    expect(cleanedText).toBe('They are linked via agency fit.');
  });

  it('keeps a span containing dotted punctuation (no brackets) intact', () => {
    const { citedNodeIds, cleanedText } = extractGraphCitationsFromMessage(
      'See [[E1:GSAFleet.gov]] for fleet data.',
      handleMap,
    );
    expect(citedNodeIds).toEqual(['node-1']);
    expect(cleanedText).toBe('See GSAFleet.gov for fleet data.');
  });

  it('keeps the span text even when the handle is unknown (prose survives; no id synthesized)', () => {
    const { citedNodeIds, cleanedText } = extractGraphCitationsFromMessage(
      'A claim about [[E9:Mystery Co]] here.',
      handleMap,
    );
    // No synthetic id — the unknown handle resolves to nothing.
    expect(citedNodeIds).toEqual([]);
    // But the entity name still reads naturally in the persisted answer.
    expect(cleanedText).toBe('A claim about Mystery Co here.');
  });

  it('drops handles absent from the map (no synthetic ids)', () => {
    const { citedNodeIds, citedEdges, cleanedText } = extractGraphCitationsFromMessage(
      'Mystery [[E9]] and [[R5]] are unknown.',
      handleMap,
    );
    expect(citedNodeIds).toEqual([]);
    expect(citedEdges).toEqual([]);
    expect(cleanedText).toBe('Mystery and are unknown.');
  });

  it('strips a malformed range/list marker instead of leaking it as literal text', () => {
    const { citedNodeIds, citedEdges, citedQueryIndices, cleanedText } = extractGraphCitationsFromMessage(
      'Connected through MENTIONS relationships [[R1-R20]] and a list [[E1, E2]].',
      handleMap,
    );
    // A range/list isn't a valid single handle — it resolves to nothing and is removed entirely.
    expect(citedNodeIds).toEqual([]);
    expect(citedEdges).toEqual([]);
    expect(citedQueryIndices).toEqual([]);
    expect(cleanedText).toBe('Connected through MENTIONS relationships and a list.');
  });

  it('dedupes repeated handles and edges', () => {
    const { citedNodeIds, citedEdges } = extractGraphCitationsFromMessage(
      '[[E1]] [[E1]] [[R1]] [[R1]]',
      handleMap,
    );
    expect(citedNodeIds).toEqual(['node-1', 'node-2']);
    expect(citedEdges).toHaveLength(1);
  });

  it('treats a null/undefined handle map as empty (no citations, markers still stripped)', () => {
    expect(extractGraphCitationsFromMessage('text [[E1]] more', undefined)).toEqual({
      citedNodeIds: [],
      citedEdges: [],
      citedQueryIndices: [],
      cleanedText: 'text more',
    });
    expect(extractGraphCitationsFromMessage('text [[E1]]', null).citedNodeIds).toEqual([]);
  });

  it('ignores an empty-string node id mapped to a handle', () => {
    const { citedNodeIds } = extractGraphCitationsFromMessage('Empty [[E3]]', { E3: '' });
    expect(citedNodeIds).toEqual([]);
  });

  it('returns no citations and unchanged text when there are no markers', () => {
    const { citedNodeIds, citedEdges, cleanedText } = extractGraphCitationsFromMessage(
      'A plain answer with no citations.',
      handleMap,
    );
    expect(citedNodeIds).toEqual([]);
    expect(citedEdges).toEqual([]);
    expect(cleanedText).toBe('A plain answer with no citations.');
  });

  it('resolves [[Q#]] handles to their result indices and strips the markers', () => {
    const { citedNodeIds, citedEdges, citedQueryIndices, cleanedText } =
      extractGraphCitationsFromMessage(
        'All agency↔company connections [[Q0]], plus the rollup [[Q1]].',
        handleMap,
      );
    expect(citedQueryIndices).toEqual([0, 1]);
    // Q# is purely a retrieval index — it adds nothing to the element-level buckets.
    expect(citedNodeIds).toEqual([]);
    expect(citedEdges).toEqual([]);
    expect(cleanedText).toBe('All agency↔company connections, plus the rollup.');
  });

  it('drops a [[Q#]] absent from the map (no synthetic index)', () => {
    const { citedQueryIndices, cleanedText } = extractGraphCitationsFromMessage(
      'Unknown query [[Q9]] should vanish.',
      handleMap,
    );
    expect(citedQueryIndices).toEqual([]);
    expect(cleanedText).toBe('Unknown query should vanish.');
  });

  it('routes a mixed [[E#]] [[R#]] [[Q#]] answer into all three buckets', () => {
    const { citedNodeIds, citedEdges, citedQueryIndices } = extractGraphCitationsFromMessage(
      'Node [[E1]] links via [[R1]] within the whole set [[Q0]].',
      handleMap,
    );
    expect(citedNodeIds).toEqual(expect.arrayContaining(['node-1', 'node-2']));
    expect(citedEdges).toEqual([{ src: 'node-1', relType: 'AGENCY_FIT', tgt: 'node-2' }]);
    expect(citedQueryIndices).toEqual([0]);
  });

  it('dedupes repeated [[Q#]] handles', () => {
    const { citedQueryIndices } = extractGraphCitationsFromMessage(
      '[[Q0]] [[Q0]] [[Q1]] [[Q0]]',
      handleMap,
    );
    expect(citedQueryIndices).toEqual([0, 1]);
  });

  it('does not treat a numeric value under an E/R handle as a query index', () => {
    // Routing is by PREFIX: a number parked under an E# handle is simply ignored (not a node id,
    // not a query index) — guards against value-shape sniffing regressions.
    const { citedNodeIds, citedQueryIndices } = extractGraphCitationsFromMessage(
      'Weird [[E5]] handle.',
      { E5: 7 as unknown as string },
    );
    expect(citedNodeIds).toEqual([]);
    expect(citedQueryIndices).toEqual([]);
  });
});

describe('resolveCitationHandle', () => {
  it('resolves an [[E#]] handle to its single node UUID, no edges', () => {
    expect(resolveCitationHandle('E1', handleMap)).toEqual({
      nodeUuids: ['node-1'],
      edges: [],
    });
  });

  it('resolves an [[R#]] handle to its triple AND both endpoint UUIDs', () => {
    expect(resolveCitationHandle('R1', handleMap)).toEqual({
      nodeUuids: ['node-1', 'node-2'],
      edges: [{ src: 'node-1', relType: 'AGENCY_FIT', tgt: 'node-2' }],
    });
  });

  it('returns empty for a [[Q#]] handle (whole-retrieval needs the message results to expand)', () => {
    expect(resolveCitationHandle('Q0', handleMap)).toEqual({ nodeUuids: [], edges: [] });
  });

  it('returns empty for a handle absent from the map (no synthetic ids)', () => {
    expect(resolveCitationHandle('E9', handleMap)).toEqual({ nodeUuids: [], edges: [] });
    expect(resolveCitationHandle('R5', handleMap)).toEqual({ nodeUuids: [], edges: [] });
  });

  it('returns empty when the map is null/undefined', () => {
    expect(resolveCitationHandle('E1', null)).toEqual({ nodeUuids: [], edges: [] });
    expect(resolveCitationHandle('E1', undefined)).toEqual({ nodeUuids: [], edges: [] });
  });

  it('ignores an empty-string node id under an [[E#]] handle', () => {
    expect(resolveCitationHandle('E3', { E3: '' })).toEqual({ nodeUuids: [], edges: [] });
  });

  it('does not resolve a mistyped value (number under E#, string under R#)', () => {
    expect(resolveCitationHandle('E5', { E5: 7 as unknown as string })).toEqual({
      nodeUuids: [],
      edges: [],
    });
    expect(resolveCitationHandle('R5', { R5: 'not-an-edge' as unknown as HandleMap[string] })).toEqual({
      nodeUuids: [],
      edges: [],
    });
  });
});

describe('resolveCitationTarget', () => {
  it('collapses an [[E#]] to a single node target', () => {
    expect(resolveCitationTarget('E1', handleMap)).toEqual({ nodeUuid: 'node-1' });
  });

  it('collapses an [[R#]] to a single edge target (the relationship, not its endpoints)', () => {
    expect(resolveCitationTarget('R1', handleMap)).toEqual({
      edge: { src: 'node-1', relType: 'AGENCY_FIT', tgt: 'node-2' },
    });
  });

  it('returns null for a [[Q#]] handle (no single element to inspect/pin)', () => {
    expect(resolveCitationTarget('Q0', handleMap)).toBeNull();
  });

  it('returns null for an unknown or nullish handle/map', () => {
    expect(resolveCitationTarget('E9', handleMap)).toBeNull();
    expect(resolveCitationTarget('E1', null)).toBeNull();
    expect(resolveCitationTarget('E1', undefined)).toBeNull();
  });
});

describe('relationshipTypeMatches', () => {
  // Real-world shape: a rendered edge carries the GENERIC Neo4j type at `type` and the SEMANTIC type
  // at `properties.relationType`. The handle map's cited relType is sometimes one, sometimes the other.
  const usesEdge = { type: 'RELATED', properties: { relationType: 'USES' } };

  it('matches when the cited relType equals the generic edge type (handle stored "RELATED")', () => {
    // This is the bug case: handle relType "RELATED" must match a USES edge whose raw type is RELATED.
    expect(relationshipTypeMatches('RELATED', usesEdge)).toBe(true);
  });

  it('matches when the cited relType equals the semantic relationType (handle stored "USES")', () => {
    expect(relationshipTypeMatches('USES', usesEdge)).toBe(true);
  });

  it('does not match an unrelated relationship type', () => {
    expect(relationshipTypeMatches('PART_OF', usesEdge)).toBe(false);
  });

  it('falls back to the raw type when there is no semantic relationType', () => {
    expect(relationshipTypeMatches('KNOWS', { type: 'KNOWS', properties: {} })).toBe(true);
    expect(relationshipTypeMatches('KNOWS', { type: 'KNOWS' })).toBe(true);
  });
});

describe('handleResolvesOnGraph / filterHandlesToGraph', () => {
  // node-1 and node-2 are on the graph, joined by a USES edge stored in the REAL shape (generic type
  // 'RELATED', semantic at properties.relationType); node-3 is NOT on the graph.
  const graph: CitationGraph = {
    nodes: [
      { id: 1, properties: { id: 'node-1' } },
      { id: 2, properties: { id: 'node-2' } },
    ],
    edges: [
      { from: 1, to: 2, type: 'RELATED', properties: { relationType: 'USES' } },
    ],
  };
  const map: HandleMap = {
    E1: 'node-1', // on graph
    E3: 'node-3', // NOT on graph
    R1: { src: 'node-1', relType: 'RELATED', tgt: 'node-2' }, // generic-typed handle → matches USES edge
    R2: { src: 'node-1', relType: 'NOPE', tgt: 'node-2' }, // endpoints present but no edge of that type
    Q0: 0, // whole-retrieval — never a single element
  };

  it('resolves an E# whose node is on the graph', () => {
    expect(handleResolvesOnGraph('E1', map, graph)).toBe(true);
  });

  it('does NOT resolve an E# whose node is absent from the graph', () => {
    expect(handleResolvesOnGraph('E3', map, graph)).toBe(false);
  });

  it('resolves an R# whose generic "RELATED" type matches the USES edge (the real-data shape)', () => {
    expect(handleResolvesOnGraph('R1', map, graph)).toBe(true);
  });

  it('does NOT resolve an R# whose relationship type matches no rendered edge', () => {
    expect(handleResolvesOnGraph('R2', map, graph)).toBe(false);
  });

  it('does NOT resolve a Q# (no single element)', () => {
    expect(handleResolvesOnGraph('Q0', map, graph)).toBe(false);
  });

  it('returns false when there is no graph to check against', () => {
    expect(handleResolvesOnGraph('E1', map, null)).toBe(false);
  });

  it('filterHandlesToGraph keeps only the handles present on the graph (drops Q# + off-graph)', () => {
    expect(filterHandlesToGraph(map, graph)).toEqual({
      E1: 'node-1',
      R1: { src: 'node-1', relType: 'RELATED', tgt: 'node-2' },
    });
  });

  it('filterHandlesToGraph returns the full map unchanged when there is no graph (can’t gate)', () => {
    expect(filterHandlesToGraph(map, null)).toBe(map);
  });
});
