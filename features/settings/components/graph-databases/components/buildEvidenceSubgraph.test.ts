import { buildEvidenceSubgraph } from './buildEvidenceSubgraph';
import { allEdgeKeys, evidenceEdgeKey } from './graphEdgeKey';

type N = { id: number; properties: { id: string } };
type E = { from: number; to: number; type: string; properties: { relationType?: string } };

const node = (id: number, uuid: string): N => ({ id, properties: { id: uuid } });
const edge = (from: number, to: number, type: string): E => ({ from, to, type, properties: {} });

// Three agencies + one company. Two AGENCY_FIT edges (agency↔agency) and one CONTRACTS_WITH
// (agency→company), so we can exercise the node-Isolate vs rel-Isolate distinction.
const CISA = node(10, 'uuid-cisa');
const DHS = node(20, 'uuid-dhs');
const FBI = node(30, 'uuid-fbi');
const ACME = node(40, 'uuid-acme');

const AGENCY_FIT_1 = edge(10, 20, 'AGENCY_FIT'); // CISA—DHS
const AGENCY_FIT_2 = edge(20, 30, 'AGENCY_FIT'); // DHS—FBI
const CONTRACTS = edge(10, 40, 'CONTRACTS_WITH'); // CISA—ACME

const graphData = { nodes: [CISA, DHS, FBI, ACME], edges: [AGENCY_FIT_1, AGENCY_FIT_2, CONTRACTS] };

const ALL_NODES = ['uuid-cisa', 'uuid-dhs', 'uuid-fbi', 'uuid-acme'];
const ALL_EDGES = allEdgeKeys(graphData);

const K = (s: string, type: string, t: string) => evidenceEdgeKey(s, type, t);

describe('buildEvidenceSubgraph — truth table', () => {
  it('default arrival (all nodes + all edges) → full subgraph', () => {
    const { nodes, edges } = buildEvidenceSubgraph(graphData, ALL_NODES, ALL_EDGES);
    expect(nodes).toHaveLength(4);
    expect(edges).toEqual([AGENCY_FIT_1, AGENCY_FIT_2, CONTRACTS]);
  });

  it('uncheck node X (additive) → integrity drops X\'s edges', () => {
    // Drop FBI: AGENCY_FIT_2 (DHS—FBI) must vanish even though its key is still checked.
    const nodes = ALL_NODES.filter((u) => u !== 'uuid-fbi');
    const { edges } = buildEvidenceSubgraph(graphData, nodes, ALL_EDGES);
    expect(edges).toEqual([AGENCY_FIT_1, CONTRACTS]);
  });

  it('uncheck edge e (additive) → only e drops, nodes stay', () => {
    const edges = ALL_EDGES.filter((k) => k !== K('uuid-cisa', 'AGENCY_FIT', 'uuid-dhs'));
    const result = buildEvidenceSubgraph(graphData, ALL_NODES, edges);
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toEqual([AGENCY_FIT_2, CONTRACTS]);
  });

  it('node filter agency → Isolate (checkedNodes = agencies, edges unchanged) → induced edges among agencies', () => {
    const agencies = ['uuid-cisa', 'uuid-dhs', 'uuid-fbi'];
    const { nodes, edges } = buildEvidenceSubgraph(graphData, agencies, ALL_EDGES);
    expect(nodes.map((n) => n.properties.id)).toEqual(agencies);
    // CONTRACTS_WITH drops (ACME no longer a checked node); both AGENCY_FIT remain.
    expect(edges).toEqual([AGENCY_FIT_1, AGENCY_FIT_2]);
  });

  it('rel filter AGENCY_FIT → Isolate (checkedNodes = endpoints, checkedEdges = AGENCY_FIT) → only those edges + endpoints', () => {
    const fitKeys = [K('uuid-cisa', 'AGENCY_FIT', 'uuid-dhs'), K('uuid-dhs', 'AGENCY_FIT', 'uuid-fbi')];
    const endpoints = ['uuid-cisa', 'uuid-dhs', 'uuid-fbi'];
    const { nodes, edges } = buildEvidenceSubgraph(graphData, endpoints, fitKeys);
    expect(nodes.map((n) => n.properties.id)).toEqual(endpoints);
    expect(edges).toEqual([AGENCY_FIT_1, AGENCY_FIT_2]);
    expect(edges).not.toContain(CONTRACTS);
  });

  it('endpoint integrity: a checked edge whose endpoint is unchecked does NOT render', () => {
    // Check the CONTRACTS edge but only CISA (not ACME) → no edge.
    const contractsKey = K('uuid-cisa', 'CONTRACTS_WITH', 'uuid-acme');
    const { nodes, edges } = buildEvidenceSubgraph(graphData, ['uuid-cisa'], [contractsKey]);
    expect(nodes.map((n) => n.properties.id)).toEqual(['uuid-cisa']);
    expect(edges).toHaveLength(0);
  });

  it('empty node selection → empty nodes and empty edges', () => {
    const { nodes, edges } = buildEvidenceSubgraph(graphData, [], ALL_EDGES);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });
});
