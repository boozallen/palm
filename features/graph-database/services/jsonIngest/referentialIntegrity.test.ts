import { validateReferentialIntegrity } from '@/features/graph-database/services/jsonIngest/referentialIntegrity';
import type { PalmGraph } from '@/features/graph-database/services/jsonIngest/types';

const basePalmGraph: PalmGraph = {
  metadata: { schema_version: 'palm-graph' },
  entities: [
    { id: 'company:acme', label: 'Entity', type: 'company', name: 'ACME' },
    { id: 'agency:army', label: 'Entity', type: 'agency', name: 'Army' },
  ],
  relations: [
    { source: 'company:acme', target: 'agency:army', type: 'RELEVANT_TO_AGENCY' },
  ],
};

describe('validateReferentialIntegrity', () => {
  it('passes for a valid palm-graph', () => {
    expect(() => validateReferentialIntegrity(basePalmGraph)).not.toThrow();
  });

  it('throws on duplicate entity ids', () => {
    const palmGraph: PalmGraph = {
      ...basePalmGraph,
      entities: [
        ...basePalmGraph.entities,
        { id: 'company:acme', label: 'Entity', type: 'company', name: 'Dup' },
      ],
    };
    expect(() => validateReferentialIntegrity(palmGraph)).toThrow(/Duplicate entity ids/);
  });

  it('throws on relation with unknown source', () => {
    const palmGraph: PalmGraph = {
      ...basePalmGraph,
      relations: [
        { source: 'company:missing', target: 'agency:army', type: 'X' },
      ],
    };
    expect(() => validateReferentialIntegrity(palmGraph)).toThrow(/sources not present/);
  });

  it('throws on relation with unknown target', () => {
    const palmGraph: PalmGraph = {
      ...basePalmGraph,
      relations: [
        { source: 'company:acme', target: 'agency:missing', type: 'X' },
      ],
    };
    expect(() => validateReferentialIntegrity(palmGraph)).toThrow(/targets not present/);
  });

  it('throws on relation type containing a hyphen', () => {
    const palmGraph: PalmGraph = {
      ...basePalmGraph,
      relations: [
        { source: 'company:acme', target: 'agency:army', type: 'HAS-CAPABILITY' },
      ],
    };
    expect(() => validateReferentialIntegrity(palmGraph)).toThrow(/Relation types must match/);
  });

  it('throws on property key with special characters', () => {
    const palmGraph: PalmGraph = {
      ...basePalmGraph,
      entities: [
        {
          id: 'company:acme',
          label: 'Entity',
          type: 'company',
          name: 'ACME',
          properties: { 'my.prop': 'value' },
        },
        { id: 'agency:army', label: 'Entity', type: 'agency', name: 'Army' },
      ],
    };
    expect(() => validateReferentialIntegrity(palmGraph)).toThrow(/Property keys must match/);
  });

  it('throws on supplementary.corporate_structure with unknown company_entity_id', () => {
    const palmGraph: PalmGraph = {
      ...basePalmGraph,
      supplementary: {
        corporate_structure: [
          { company_entity_id: 'company:missing' },
        ],
      },
    };
    expect(() => validateReferentialIntegrity(palmGraph)).toThrow(
      /corporate_structure references unknown/
    );
  });

  it('throws on supplementary.partnering_match_hits with unknown company_entity_id', () => {
    const palmGraph: PalmGraph = {
      ...basePalmGraph,
      supplementary: {
        partnering_match_hits: [
          {
            company_entity_id: 'company:missing',
            partnering_posture_id: 'pp:x',
            match_hits: ['foo'],
          },
        ],
      },
    };
    expect(() => validateReferentialIntegrity(palmGraph)).toThrow(
      /partnering_match_hits references unknown/
    );
  });

  it('caps error message sample ids at 5 and reports total count', () => {
    const entities = Array.from({ length: 10 }, (_, i) => ({
      id: `company:a${i}`,
      label: 'Entity' as const,
      type: 'company',
      name: `A${i}`,
    }));
    const relations = Array.from({ length: 8 }, (_, i) => ({
      source: `company:missing${i}`,
      target: 'company:a0',
      type: 'REL',
    }));
    const palmGraph: PalmGraph = {
      metadata: { schema_version: 'palm-graph' },
      entities,
      relations,
    };
    try {
      validateReferentialIntegrity(palmGraph);
      fail('expected validateReferentialIntegrity to throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/total 8/);
      // First 5 samples present, 6th-8th not listed individually
      expect(message).toContain('company:missing0');
      expect(message).toContain('company:missing4');
      expect(message).not.toContain('company:missing5');
    }
  });
});
