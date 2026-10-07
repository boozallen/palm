import {
  mergeCorporateStructure,
  mergePartneringMatchHits,
} from '@/features/graph-database/services/jsonIngest/supplementaryMerger';
import type { ValidEntity, ValidRelation } from '@/features/graph-database/services/jsonIngest/types';

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as any;

describe('mergeCorporateStructure', () => {
  beforeEach(() => jest.clearAllMocks());

  const entities: ValidEntity[] = [
    { id: 'company:acme', label: 'Entity', type: 'company', name: 'ACME' },
    { id: 'company:patientping', label: 'Entity', type: 'company', name: 'PatientPing' },
  ];

  it('returns entities unchanged and zero parent edges when rows are absent', () => {
    const result = mergeCorporateStructure(entities, undefined);
    expect(result.entities).toEqual(entities);
    expect(result.parentEdges).toHaveLength(0);
  });

  it('attaches supplementary fields but creates no parent entity when parent is null', () => {
    const result = mergeCorporateStructure(entities, [
      {
        company_entity_id: 'company:acme',
        parent_or_controlling_entity: null,
        normalized_corporate_status: 'independent',
      },
    ]);
    const acme = result.entities.find((e) => e.id === 'company:acme');
    expect(acme?.properties?.normalized_corporate_status).toBe('independent');
    expect(result.parentEdges).toHaveLength(0);
    // No synthesized parent entity
    expect(result.entities.filter((e) => e.type === 'parent_company')).toHaveLength(0);
  });

  it('synthesizes parent entity + CONTROLLED_BY edge when parent set', () => {
    const result = mergeCorporateStructure(entities, [
      {
        company_entity_id: 'company:patientping',
        parent_or_controlling_entity: 'Bamboo Health',
        normalized_corporate_status: 'acquired_or_absorbed',
      },
    ]);
    const parent = result.entities.find((e) => e.type === 'parent_company');
    expect(parent).toBeDefined();
    expect(parent?.name).toBe('Bamboo Health');
    expect(result.parentEdges).toHaveLength(1);
    expect(result.parentEdges[0]).toEqual({
      source: 'company:patientping',
      target: parent!.id,
      type: 'CONTROLLED_BY',
      properties: {},
    });
  });

  it('dedupes a shared parent across multiple children', () => {
    const input: ValidEntity[] = [
      { id: 'company:a', label: 'Entity', type: 'company', name: 'A' },
      { id: 'company:b', label: 'Entity', type: 'company', name: 'B' },
    ];
    const result = mergeCorporateStructure(input, [
      { company_entity_id: 'company:a', parent_or_controlling_entity: 'Bamboo Health' },
      { company_entity_id: 'company:b', parent_or_controlling_entity: 'Bamboo Health' },
    ]);
    const parents = result.entities.filter((e) => e.type === 'parent_company');
    expect(parents).toHaveLength(1);
    expect(result.parentEdges).toHaveLength(2);
  });

  it('does not mutate the input entities array', () => {
    const input: ValidEntity[] = [
      { id: 'company:acme', label: 'Entity', type: 'company', name: 'ACME' },
    ];
    const beforeLength = input.length;
    mergeCorporateStructure(input, [
      { company_entity_id: 'company:acme', parent_or_controlling_entity: 'X' },
    ]);
    expect(input.length).toBe(beforeLength);
    expect(input[0].properties).toBeUndefined();
  });
});

describe('mergePartneringMatchHits', () => {
  beforeEach(() => jest.clearAllMocks());

  const relations: ValidRelation[] = [
    {
      source: 'company:acme',
      target: 'partnering_posture:integrator',
      type: 'HAS_PARTNERING_POSTURE',
    },
    {
      source: 'company:acme',
      target: 'agency:army',
      type: 'RELEVANT_TO_AGENCY',
    },
  ];

  it('returns relations unchanged when no hits are provided', () => {
    const result = mergePartneringMatchHits(relations, undefined, mockLogger);
    expect(result).toEqual(relations);
  });

  it('attaches match_hits to the matching edge', () => {
    const result = mergePartneringMatchHits(
      relations,
      [
        {
          company_entity_id: 'company:acme',
          partnering_posture_id: 'partnering_posture:integrator',
          match_hits: ['integration-friendly', 'open api'],
        },
      ],
      mockLogger
    );
    const updated = result.find(
      (r) => r.type === 'HAS_PARTNERING_POSTURE'
    );
    expect(updated?.properties?.match_hits).toEqual([
      'integration-friendly',
      'open api',
    ]);
  });

  it('logs a warning and does not throw when hit has no matching edge', () => {
    const result = mergePartneringMatchHits(
      relations,
      [
        {
          company_entity_id: 'company:unknown',
          partnering_posture_id: 'partnering_posture:integrator',
          match_hits: ['foo'],
        },
      ],
      mockLogger
    );
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(result).toHaveLength(relations.length);
  });

  it('does not mutate input relations', () => {
    const input: ValidRelation[] = [
      {
        source: 'company:acme',
        target: 'partnering_posture:integrator',
        type: 'HAS_PARTNERING_POSTURE',
      },
    ];
    mergePartneringMatchHits(
      input,
      [
        {
          company_entity_id: 'company:acme',
          partnering_posture_id: 'partnering_posture:integrator',
          match_hits: ['x'],
        },
      ],
      mockLogger
    );
    expect(input[0].properties).toBeUndefined();
  });
});
