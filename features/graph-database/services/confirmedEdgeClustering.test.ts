import { closeIdentityClusters, maintainClusterHubs } from '@/features/graph-database/services/confirmedEdgeClustering';
import type { Entity, Resolution } from '@/features/graph-database/types';
import type { ResolutionEdgeName } from '@/features/graph-database/config/storage-model.config';
import type { IdentityCluster } from '@/features/graph-database/dal/getIdentityClusters';
import {
  createCluster,
  attachToCluster,
  mergeClusters,
  getHubIdsForMembers,
} from '@/features/graph-database/dal/identityClusterHubs';

jest.mock('@/features/graph-database/dal/identityClusterHubs');
jest.mock('@/server/logger');

const mockCreateCluster = createCluster as jest.MockedFunction<typeof createCluster>;
const mockAttachToCluster = attachToCluster as jest.MockedFunction<typeof attachToCluster>;
const mockMergeClusters = mergeClusters as jest.MockedFunction<typeof mergeClusters>;
const mockGetHubIdsForMembers = getHubIdsForMembers as jest.MockedFunction<typeof getHubIdsForMembers>;

function ent(id: string): Entity {
  return {
    id,
    name: id,
    type: 'ORGANIZATION',
    normalizedName: id,
    description: '',
    aliases: [],
    documentId: `doc-${id}`,
    mentionCount: 1,
    firstSeenAt: new Date('2024-01-01'),
  };
}

function identity(a: string, b: string, edgeType: ResolutionEdgeName = 'IDENTITY'): Resolution {
  return {
    entity1: ent(a),
    entity2: ent(b),
    edgeType,
    confidence: 0.95,
    rationale: 'same',
    decidedBy: 'llm',
    signals: { cosineSimScore: 0.9, sharedAliases: [], sharedDoc: false },
    policy: 'resolution_v2',
    policyVersion: '2025-01-19',
    resolvedAt: new Date('2024-01-01'),
  };
}

function findCluster(clusters: IdentityCluster[], member: string): IdentityCluster | undefined {
  return clusters.find((c) => c.memberIds.includes(member));
}

describe('closeIdentityClusters', () => {
  it('merges A≡new and new≡B into one equivalence class', () => {
    const frozen: IdentityCluster[] = [
      { representativeId: 'a1', memberIds: ['a1', 'a2'] },
      { representativeId: 'b1', memberIds: ['b1', 'b2'] },
    ];
    const confirmed = [identity('n', 'a1'), identity('n', 'b1')];

    const { mergedClusters } = closeIdentityClusters(confirmed, frozen);
    const cluster = findCluster(mergedClusters, 'n');
    expect(cluster).toBeDefined();
    expect([...cluster!.memberIds].sort()).toEqual(['a1', 'a2', 'b1', 'b2', 'n']);
  });

  it('emits exactly one free bridging IDENTITY edge when a new node joins two clusters', () => {
    const frozen: IdentityCluster[] = [
      { representativeId: 'a1', memberIds: ['a1', 'a2'] },
      { representativeId: 'b1', memberIds: ['b1', 'b2'] },
    ];
    const confirmed = [identity('n', 'a1'), identity('n', 'b1')];

    const { bridgingEdges } = closeIdentityClusters(confirmed, frozen);
    expect(bridgingEdges).toHaveLength(1);
    expect(bridgingEdges[0].edgeType).toBe('IDENTITY');
    expect(bridgingEdges[0].decidedBy).toBe('transitivity_fix');
    expect(bridgingEdges[0].policy).toBe('transitivity_enforcement');
    const ids = [bridgingEdges[0].entity1.id, bridgingEdges[0].entity2.id].sort();
    expect(ids).toEqual(['a1', 'b1']);
  });

  it('emits no bridging edge when the new node touches only one existing cluster', () => {
    const frozen: IdentityCluster[] = [{ representativeId: 'a1', memberIds: ['a1', 'a2'] }];
    const confirmed = [identity('n', 'a1')];
    const { bridgingEdges } = closeIdentityClusters(confirmed, frozen);
    expect(bridgingEdges).toEqual([]);
  });

  it('ignores SIMILAR/RELATED edges when closing (IDENTITY only)', () => {
    const frozen: IdentityCluster[] = [
      { representativeId: 'a1', memberIds: ['a1', 'a2'] },
      { representativeId: 'b1', memberIds: ['b1', 'b2'] },
    ];
    const confirmed = [
      identity('n', 'a1', 'RELATED_RESOLUTION'),
      identity('n', 'b1', 'RELATED_RESOLUTION'),
    ];
    const { bridgingEdges, mergedClusters } = closeIdentityClusters(confirmed, frozen);
    expect(bridgingEdges).toEqual([]);
    // Clusters A and B remain separate (no IDENTITY linked them)
    expect(findCluster(mergedClusters, 'a1')!.memberIds).not.toContain('b1');
  });

  it('handles the full-build case (no frozen clusters) as plain connected components', () => {
    const confirmed = [identity('n1', 'n2'), identity('n2', 'n3'), identity('m1', 'm2')];
    const { mergedClusters, bridgingEdges } = closeIdentityClusters(confirmed, []);
    expect(bridgingEdges).toEqual([]);
    const big = findCluster(mergedClusters, 'n1');
    expect([...big!.memberIds].sort()).toEqual(['n1', 'n2', 'n3']);
    const small = findCluster(mergedClusters, 'm1');
    expect([...small!.memberIds].sort()).toEqual(['m1', 'm2']);
  });

  it('dedupes bridging edges when multiple new nodes bridge the same two clusters', () => {
    const frozen: IdentityCluster[] = [
      { representativeId: 'a1', memberIds: ['a1', 'a2'] },
      { representativeId: 'b1', memberIds: ['b1', 'b2'] },
    ];
    const confirmed = [
      identity('n1', 'a1'),
      identity('n1', 'b1'),
      identity('n2', 'a1'),
      identity('n2', 'b1'),
    ];
    const { bridgingEdges } = closeIdentityClusters(confirmed, frozen);
    expect(bridgingEdges).toHaveLength(1);
  });
});

describe('maintainClusterHubs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHubIdsForMembers.mockResolvedValue(new Map());
    mockCreateCluster.mockResolvedValue('hub-new');
    mockAttachToCluster.mockResolvedValue(undefined);
    mockMergeClusters.mockResolvedValue(undefined);
  });

  it('does nothing for singleton clusters (no I/O at all)', async () => {
    const stats = await maintainClusterHubs([{ representativeId: 'a1', memberIds: ['a1'] }], 'user-1');

    expect(mockGetHubIdsForMembers).not.toHaveBeenCalled();
    expect(mockCreateCluster).not.toHaveBeenCalled();
    expect(stats).toEqual({ clustersProcessed: 0, hubsCreated: 0, membersAttached: 0, hubsMerged: 0 });
  });

  it('creates a brand new hub when no member has one yet', async () => {
    mockGetHubIdsForMembers.mockResolvedValue(new Map());

    const stats = await maintainClusterHubs([{ representativeId: 'n1', memberIds: ['n1', 'n2'] }], 'user-1');

    expect(mockCreateCluster).toHaveBeenCalledWith(['n1', 'n2'], 'user-1');
    expect(mockAttachToCluster).not.toHaveBeenCalled();
    expect(mockMergeClusters).not.toHaveBeenCalled();
    expect(stats).toEqual({ clustersProcessed: 1, hubsCreated: 1, membersAttached: 0, hubsMerged: 0 });
  });

  it('attaches only the un-hubbed members when exactly one hub is touched', async () => {
    mockGetHubIdsForMembers.mockResolvedValue(new Map([['a1', 'hub-a']]));

    const stats = await maintainClusterHubs([{ representativeId: 'a1', memberIds: ['a1', 'n1'] }], 'user-1');

    expect(mockCreateCluster).not.toHaveBeenCalled();
    expect(mockMergeClusters).not.toHaveBeenCalled();
    expect(mockAttachToCluster).toHaveBeenCalledTimes(1);
    expect(mockAttachToCluster).toHaveBeenCalledWith('n1', 'hub-a');
    expect(stats).toEqual({ clustersProcessed: 1, hubsCreated: 0, membersAttached: 1, hubsMerged: 0 });
  });

  it('merges into the lexicographically smallest hub when two hubs are touched, then attaches the rest', async () => {
    mockGetHubIdsForMembers.mockResolvedValue(
      new Map([
        ['a1', 'hub-b'],
        ['b1', 'hub-a'],
      ])
    );

    const stats = await maintainClusterHubs(
      [{ representativeId: 'a1', memberIds: ['a1', 'b1', 'n1'] }],
      'user-1'
    );

    expect(mockMergeClusters).toHaveBeenCalledWith('hub-a', 'hub-b');
    expect(mockCreateCluster).not.toHaveBeenCalled();
    expect(mockAttachToCluster).toHaveBeenCalledTimes(1);
    expect(mockAttachToCluster).toHaveBeenCalledWith('n1', 'hub-a');
    expect(stats).toEqual({ clustersProcessed: 1, hubsCreated: 0, membersAttached: 1, hubsMerged: 1 });
  });

  it('is self-healing: a pre-hub cluster with a partial hub gets the un-hubbed member attached', async () => {
    // Simulates a cluster that predates hubs (no backfill yet) where one
    // member already got a hub from an unrelated later pass.
    mockGetHubIdsForMembers.mockResolvedValue(new Map([['old1', 'hub-old']]));

    await maintainClusterHubs(
      [{ representativeId: 'old1', memberIds: ['old1', 'old2', 'old3'] }],
      'user-1'
    );

    expect(mockCreateCluster).not.toHaveBeenCalled();
    expect(mockAttachToCluster).toHaveBeenCalledTimes(2);
    expect(mockAttachToCluster).toHaveBeenCalledWith('old2', 'hub-old');
    expect(mockAttachToCluster).toHaveBeenCalledWith('old3', 'hub-old');
  });

  it('processes multiple merged clusters independently', async () => {
    mockGetHubIdsForMembers.mockResolvedValue(new Map());

    await maintainClusterHubs(
      [
        { representativeId: 'n1', memberIds: ['n1', 'n2'] },
        { representativeId: 'm1', memberIds: ['m1', 'm2'] },
      ],
      'user-1'
    );

    expect(mockCreateCluster).toHaveBeenCalledTimes(2);
    expect(mockCreateCluster).toHaveBeenCalledWith(['n1', 'n2'], 'user-1');
    expect(mockCreateCluster).toHaveBeenCalledWith(['m1', 'm2'], 'user-1');
  });
});
