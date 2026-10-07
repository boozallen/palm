import { palmGraphSchema } from '@/features/graph-database/services/jsonIngest/types';

describe('palmGraphSchema', () => {
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

  it('parses a valid minimal palm-graph', () => {
    const parsed = palmGraphSchema.parse(minimalValidPalmGraph);
    expect(parsed.entities).toHaveLength(1);
    expect(parsed.relations).toHaveLength(0);
  });

  it('accepts any schema_version value (no longer enforced)', () => {
    const variants = [
      { ...minimalValidPalmGraph, metadata: { schema_version: 'palm-graph-v1' } },
      { ...minimalValidPalmGraph, metadata: { schema_version: 'potato' } },
      { ...minimalValidPalmGraph, metadata: {} },
    ];
    for (const variant of variants) {
      expect(() => palmGraphSchema.parse(variant)).not.toThrow();
    }
  });

  it('accepts bundle with no metadata field at all', () => {
    const valid = {
      entities: minimalValidPalmGraph.entities,
      relations: minimalValidPalmGraph.relations,
    };
    expect(() => palmGraphSchema.parse(valid)).not.toThrow();
  });

  it('throws when entities key is missing', () => {
    const invalid = {
      metadata: { schema_version: 'palm-graph' },
      relations: [],
    };
    expect(() => palmGraphSchema.parse(invalid)).toThrow();
  });

  it('throws when entities array is empty', () => {
    const invalid = { ...minimalValidPalmGraph, entities: [] };
    expect(() => palmGraphSchema.parse(invalid)).toThrow();
  });

  it('throws when entity label is not Entity or Concept', () => {
    const invalid = {
      ...minimalValidPalmGraph,
      entities: [
        {
          id: 'x',
          label: 'Thing',
          type: 'company',
          name: 'X',
        },
      ],
    };
    expect(() => palmGraphSchema.parse(invalid)).toThrow();
  });

  it('throws when entity is missing name', () => {
    const invalid = {
      ...minimalValidPalmGraph,
      entities: [
        {
          id: 'x',
          label: 'Entity',
          type: 'company',
        },
      ],
    };
    expect(() => palmGraphSchema.parse(invalid)).toThrow();
  });

  it('throws when entity has an unknown field (strict)', () => {
    const invalid = {
      ...minimalValidPalmGraph,
      entities: [
        {
          id: 'x',
          label: 'Entity',
          type: 'company',
          name: 'X',
          surprise: 'unexpected',
        },
      ],
    };
    expect(() => palmGraphSchema.parse(invalid)).toThrow();
  });

  it('throws when a relation is missing source', () => {
    const invalid = {
      ...minimalValidPalmGraph,
      relations: [{ target: 'company:acme', type: 'HAS' }],
    };
    expect(() => palmGraphSchema.parse(invalid)).toThrow();
  });

  it('throws when a relation is missing target', () => {
    const invalid = {
      ...minimalValidPalmGraph,
      relations: [{ source: 'company:acme', type: 'HAS' }],
    };
    expect(() => palmGraphSchema.parse(invalid)).toThrow();
  });

  it('throws when a relation is missing type', () => {
    const invalid = {
      ...minimalValidPalmGraph,
      relations: [{ source: 'company:acme', target: 'company:acme' }],
    };
    expect(() => palmGraphSchema.parse(invalid)).toThrow();
  });

  it('accepts a palm-graph with no supplementary section', () => {
    expect(() => palmGraphSchema.parse(minimalValidPalmGraph)).not.toThrow();
  });

  it('accepts supplementary.corporate_structure with a non-null parent', () => {
    const valid = {
      ...minimalValidPalmGraph,
      supplementary: {
        corporate_structure: [
          {
            company_entity_id: 'company:acme',
            parent_or_controlling_entity: 'Parent Co',
          },
        ],
      },
    };
    expect(() => palmGraphSchema.parse(valid)).not.toThrow();
  });

  it('accepts supplementary.corporate_structure with null parent', () => {
    const valid = {
      ...minimalValidPalmGraph,
      supplementary: {
        corporate_structure: [
          {
            company_entity_id: 'company:acme',
            parent_or_controlling_entity: null,
          },
        ],
      },
    };
    expect(() => palmGraphSchema.parse(valid)).not.toThrow();
  });

  it('accepts unknown top-level keys via passthrough', () => {
    const valid = {
      ...minimalValidPalmGraph,
      schema: { declared: true },
      artifact_index: ['foo'],
    };
    expect(() => palmGraphSchema.parse(valid)).not.toThrow();
  });

  it('accepts extra informational fields inside metadata', () => {
    const valid = {
      ...minimalValidPalmGraph,
      metadata: {
        schema_version: 'palm-graph',
        generated_at: '2026-04-22',
        run_id: 'abc',
      },
    };
    expect(() => palmGraphSchema.parse(valid)).not.toThrow();
  });

  it('accepts entities with a top-level description (string, null, or absent)', () => {
    const entities = [
      { id: 'a', label: 'Entity', type: 'company', name: 'A', description: 'Defense firm.' },
      { id: 'b', label: 'Entity', type: 'company', name: 'B', description: null },
      { id: 'c', label: 'Entity', type: 'company', name: 'C' },
    ];
    const valid = { ...minimalValidPalmGraph, entities };
    const parsed = palmGraphSchema.parse(valid);
    expect(parsed.entities[0].description).toBe('Defense firm.');
    expect(parsed.entities[1].description).toBeNull();
    expect(parsed.entities[2].description).toBeUndefined();
  });
});
