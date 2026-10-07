import { selectClusterRepresentatives } from '@/features/graph-database/services/clusterRepresentatives';
import type { Entity, Concept } from '@/features/graph-database/types';

function entity(
  id: string,
  name: string,
  overrides: Partial<Entity> = {}
): Entity {
  return {
    id,
    name,
    type: 'ORGANIZATION',
    normalizedName: name.toLowerCase().trim(),
    description: `desc ${name}`,
    aliases: [],
    documentId: `doc-${id}`,
    mentionCount: 1,
    firstSeenAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function concept(id: string, name: string, overrides: Partial<Concept> = {}): Concept {
  return {
    id,
    name,
    category: 'GENERAL' as Concept['category'],
    description: `desc ${name}`,
    documentId: `doc-${id}`,
    mentionCount: 1,
    firstSeenAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('selectClusterRepresentatives', () => {
  it('collapses three surfaced members of one hub to a single representative', () => {
    const e1 = entity('e1', 'IBM');
    const e2 = entity('e2', 'I.B.M.');
    const e3 = entity('e3', 'International Business Machines');
    const hubByMember = new Map([
      ['e1', 'hub-1'],
      ['e2', 'hub-1'],
      ['e3', 'hub-1'],
    ]);

    const result = selectClusterRepresentatives({
      surfaced: [
        { node: e1, similarity: 0.9 },
        { node: e2, similarity: 0.95 },
        { node: e3, similarity: 0.92 },
      ],
      hubByMember,
      newNodeIds: new Set(),
      isConcept: false,
    });

    expect(result.stats.clustersCollapsed).toBe(1);
    expect(result.stats.candidatesCollapsed).toBe(3);
    expect(result.representativeByMember.get('e1')).toBe('e2');
    expect(result.representativeByMember.get('e2')).toBe('e2');
    expect(result.representativeByMember.get('e3')).toBe('e2');
    expect(result.representativeNodeById.size).toBe(1);
  });

  it('picks the highest-similarity member, tie-broken by lowest id', () => {
    const e1 = entity('e2', 'IBM'); // deliberately id 'e2' to test tie-break vs 'e1' below
    const e2 = entity('e1', 'IBM');
    const hubByMember = new Map([
      ['e2', 'hub-1'],
      ['e1', 'hub-1'],
    ]);

    const result = selectClusterRepresentatives({
      surfaced: [
        { node: e1, similarity: 0.9 },
        { node: e2, similarity: 0.9 }, // tie
      ],
      hubByMember,
      newNodeIds: new Set(),
      isConcept: false,
    });

    // Tie on similarity -> lowest id ('e1') wins.
    expect([...result.representativeNodeById.keys()]).toEqual(['e1']);
  });

  it('picks strictly the higher-similarity member over a lower one regardless of id', () => {
    const low = entity('zzz', 'IBM');
    const high = entity('aaa', 'IBM');
    const hubByMember = new Map([
      ['zzz', 'hub-1'],
      ['aaa', 'hub-1'],
    ]);

    const result = selectClusterRepresentatives({
      surfaced: [
        { node: low, similarity: 0.8 },
        { node: high, similarity: 0.99 },
      ],
      hubByMember,
      newNodeIds: new Set(),
      isConcept: false,
    });

    expect([...result.representativeNodeById.keys()]).toEqual(['aaa']);
  });

  it('builds aliases as the deduplicated union of all members, excluding the representative own name', () => {
    const rep = entity('rep', 'IBM', { aliases: ['Big Blue'] });
    const other = entity('other', 'I.B.M.', { aliases: ['International Business Machines', 'ibm'] }); // 'ibm' dupes rep's own name (case-insensitive)
    const hubByMember = new Map([
      ['rep', 'hub-1'],
      ['other', 'hub-1'],
    ]);

    const result = selectClusterRepresentatives({
      surfaced: [
        { node: rep, similarity: 0.99 }, // rep wins on similarity
        { node: other, similarity: 0.9 },
      ],
      hubByMember,
      newNodeIds: new Set(),
      isConcept: false,
    });

    const enriched = result.representativeNodeById.get('rep') as Entity;
    expect(enriched.aliases.sort()).toEqual(
      ['Big Blue', 'I.B.M.', 'International Business Machines'].sort()
    );
    // The representative's own name never appears in its own aliases list.
    expect(enriched.aliases).not.toContain('IBM');
  });

  it('sets description to the longest non-empty description in the group', () => {
    const rep = entity('rep', 'IBM', { description: 'short' });
    const other = entity('other', 'I.B.M.', { description: 'a much longer description of IBM' });
    const hubByMember = new Map([
      ['rep', 'hub-1'],
      ['other', 'hub-1'],
    ]);

    const result = selectClusterRepresentatives({
      surfaced: [
        { node: rep, similarity: 0.99 },
        { node: other, similarity: 0.9 },
      ],
      hubByMember,
      newNodeIds: new Set(),
      isConcept: false,
    });

    const enriched = result.representativeNodeById.get('rep') as Entity;
    expect(enriched.description).toBe('a much longer description of IBM');
  });

  it('preserves the representative real id/name/type/documentId/mentionCount/firstSeenAt', () => {
    const rep = entity('rep', 'IBM', { type: 'ORGANIZATION', documentId: 'doc-rep', mentionCount: 7 });
    const other = entity('other', 'I.B.M.');
    const hubByMember = new Map([
      ['rep', 'hub-1'],
      ['other', 'hub-1'],
    ]);

    const result = selectClusterRepresentatives({
      surfaced: [
        { node: rep, similarity: 0.99 },
        { node: other, similarity: 0.9 },
      ],
      hubByMember,
      newNodeIds: new Set(),
      isConcept: false,
    });

    const enriched = result.representativeNodeById.get('rep') as Entity;
    expect(enriched.id).toBe('rep');
    expect(enriched.name).toBe('IBM');
    expect(enriched.type).toBe('ORGANIZATION');
    expect(enriched.documentId).toBe('doc-rep');
    expect(enriched.mentionCount).toBe(7);
    expect(enriched.firstSeenAt).toEqual(rep.firstSeenAt);
  });

  it('does not collapse a hub with only one surfaced member', () => {
    const e1 = entity('e1', 'IBM');
    const hubByMember = new Map([['e1', 'hub-1']]);

    const result = selectClusterRepresentatives({
      surfaced: [{ node: e1, similarity: 0.9 }],
      hubByMember,
      newNodeIds: new Set(),
      isConcept: false,
    });

    expect(result.stats.clustersCollapsed).toBe(0);
    expect(result.representativeByMember.size).toBe(0);
  });

  it('does not collapse when every surfaced member of a hub is a new node', () => {
    const n1 = entity('n1', 'IBM');
    const n2 = entity('n2', 'I.B.M.');
    const hubByMember = new Map([
      ['n1', 'hub-1'],
      ['n2', 'hub-1'],
    ]);

    const result = selectClusterRepresentatives({
      surfaced: [
        { node: n1, similarity: 0.9 },
        { node: n2, similarity: 0.9 },
      ],
      hubByMember,
      newNodeIds: new Set(['n1', 'n2']),
      isConcept: false,
    });

    expect(result.stats.clustersCollapsed).toBe(0);
  });

  it('excludes a new node from a group even when its hub-mates are collapsed', () => {
    const existing1 = entity('e1', 'IBM');
    const existing2 = entity('e2', 'I.B.M.');
    const reResolvedNew = entity('n1', 'IBM Corp'); // already in a hub, but new this pass
    const hubByMember = new Map([
      ['e1', 'hub-1'],
      ['e2', 'hub-1'],
      ['n1', 'hub-1'],
    ]);

    const result = selectClusterRepresentatives({
      surfaced: [
        { node: existing1, similarity: 0.9 },
        { node: existing2, similarity: 0.95 },
        { node: reResolvedNew, similarity: 0.99 },
      ],
      hubByMember,
      newNodeIds: new Set(['n1']),
      isConcept: false,
    });

    // Collapse still happens over the two existing members...
    expect(result.stats.candidatesCollapsed).toBe(2);
    // ...but the new node is never chosen as (or folded into) the representative.
    expect(result.representativeByMember.has('n1')).toBe(false);
    expect([...result.representativeNodeById.keys()]).toEqual(['e2']);
  });

  it('gives concepts a description but never an aliases field', () => {
    const rep = concept('c1', 'Cloud Computing', { description: 'short' });
    const other = concept('c2', 'cloud computing', { description: 'a longer description' });
    const hubByMember = new Map([
      ['c1', 'hub-1'],
      ['c2', 'hub-1'],
    ]);

    const result = selectClusterRepresentatives({
      surfaced: [
        { node: rep, similarity: 0.9 },
        { node: other, similarity: 0.95 },
      ],
      hubByMember,
      newNodeIds: new Set(),
      isConcept: true,
    });

    const enriched = result.representativeNodeById.get('c2') as Concept;
    expect(enriched.description).toBe('a longer description');
    expect((enriched as unknown as Entity).aliases).toBeUndefined();
  });

  it('is deterministic under input reordering', () => {
    const e1 = entity('e1', 'IBM', { aliases: ['Big Blue'], description: 'short' });
    const e2 = entity('e2', 'I.B.M.', { aliases: ['IBM Corp'], description: 'a much longer description' });
    const e3 = entity('e3', 'International Business Machines', { description: 'medium length one' });
    const hubByMember = new Map([
      ['e1', 'hub-1'],
      ['e2', 'hub-1'],
      ['e3', 'hub-1'],
    ]);

    const forward = selectClusterRepresentatives({
      surfaced: [
        { node: e1, similarity: 0.9 },
        { node: e2, similarity: 0.9 },
        { node: e3, similarity: 0.9 },
      ],
      hubByMember,
      newNodeIds: new Set(),
      isConcept: false,
    });
    const reversed = selectClusterRepresentatives({
      surfaced: [
        { node: e3, similarity: 0.9 },
        { node: e2, similarity: 0.9 },
        { node: e1, similarity: 0.9 },
      ],
      hubByMember,
      newNodeIds: new Set(),
      isConcept: false,
    });

    expect([...forward.representativeNodeById.keys()]).toEqual([...reversed.representativeNodeById.keys()]);
    const forwardRep = forward.representativeNodeById.values().next().value as Entity;
    const reversedRep = reversed.representativeNodeById.values().next().value as Entity;
    expect(forwardRep.description).toBe(reversedRep.description);
    expect(forwardRep.aliases).toEqual(reversedRep.aliases);
  });

  it('does not mutate any input node', () => {
    const e1 = entity('e1', 'IBM', { aliases: ['Big Blue'] });
    const e2 = entity('e2', 'I.B.M.', { aliases: ['IBM Corp'] });
    const e1Snapshot = JSON.parse(JSON.stringify(e1));
    const e2Snapshot = JSON.parse(JSON.stringify(e2));
    const hubByMember = new Map([
      ['e1', 'hub-1'],
      ['e2', 'hub-1'],
    ]);

    selectClusterRepresentatives({
      surfaced: [
        { node: e1, similarity: 0.9 },
        { node: e2, similarity: 0.95 },
      ],
      hubByMember,
      newNodeIds: new Set(),
      isConcept: false,
    });

    expect(JSON.parse(JSON.stringify(e1))).toEqual(e1Snapshot);
    expect(JSON.parse(JSON.stringify(e2))).toEqual(e2Snapshot);
  });
});
