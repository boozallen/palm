import { tryParsePalmGraph } from '@/features/graph-database/services/jsonIngest/detectPalmGraph';
import noMetadataFixture from '@/features/graph-database/data/palm-graph-fixtures/small-valid-palm-graph-no-metadata.json';

const minimalValidPalmGraph = {
  metadata: { schema_version: 'palm-graph' },
  entities: [
    {
      id: 'company:acme',
      label: 'Entity',
      type: 'company',
      name: 'ACME Defense',
    },
  ],
  relations: [],
};

describe('tryParsePalmGraph', () => {
  it('returns null for null input', () => {
    expect(tryParsePalmGraph(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(tryParsePalmGraph(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(tryParsePalmGraph('')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(tryParsePalmGraph('not json {')).toBeNull();
  });

  it('returns parsed palm-graph when metadata is omitted', () => {
    const text = JSON.stringify({
      entities: minimalValidPalmGraph.entities,
      relations: minimalValidPalmGraph.relations,
    });
    const result = tryParsePalmGraph(text);
    expect(result).not.toBeNull();
    expect(result!.entities).toHaveLength(1);
    expect(result!.metadata).toBeUndefined();
  });

  it('returns parsed palm-graph for arbitrary metadata.schema_version values', () => {
    const text = JSON.stringify({
      ...minimalValidPalmGraph,
      metadata: { schema_version: 'something-else' },
    });
    const result = tryParsePalmGraph(text);
    expect(result).not.toBeNull();
    expect(result!.metadata?.schema_version).toBe('something-else');
  });

  it('returns null when entities array is empty', () => {
    const text = JSON.stringify({
      ...minimalValidPalmGraph,
      entities: [],
    });
    expect(tryParsePalmGraph(text)).toBeNull();
  });

  it('returns a typed PalmGraph for a minimal valid palm-graph', () => {
    const text = JSON.stringify(minimalValidPalmGraph);
    const result = tryParsePalmGraph(text);
    expect(result).not.toBeNull();
    expect(result!.entities).toHaveLength(1);
    expect(result!.entities[0].id).toBe('company:acme');
    expect(result!.metadata?.schema_version).toBe('palm-graph');
  });

  it('parses an end-to-end fixture that omits metadata', () => {
    const result = tryParsePalmGraph(JSON.stringify(noMetadataFixture));
    expect(result).not.toBeNull();
    expect(result!.metadata).toBeUndefined();
    expect(result!.entities.length).toBeGreaterThan(0);
    expect(result!.entities[0].id).toBe('company:acme');
  });
});
