import { reconcileIdentityClusterHubs } from '@/features/graph-database/services/reconcileIdentityClusterHubs';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { maintainClusterHubs } from '@/features/graph-database/services/confirmedEdgeClustering';
import { bulkCreateClusters, getHubIdsForMembers } from '@/features/graph-database/dal/identityClusterHubs';
import type { IdentityCluster } from '@/features/graph-database/dal/getIdentityClusters';

jest.mock('@/features/graph-database');
jest.mock('@/features/graph-database/services/confirmedEdgeClustering');
jest.mock('@/features/graph-database/dal/identityClusterHubs');
jest.mock('@/server/logger');

const mockRun = jest.fn();
const mockMaintainClusterHubs = maintainClusterHubs as jest.MockedFunction<typeof maintainClusterHubs>;
const mockBulkCreateClusters = bulkCreateClusters as jest.MockedFunction<typeof bulkCreateClusters>;
const mockGetHubIdsForMembers = getHubIdsForMembers as jest.MockedFunction<typeof getHubIdsForMembers>;

function rec(obj: Record<string, string>) {
  return { get: (key: string) => obj[key] };
}

function userRecords(...userIds: string[]) {
  return { records: userIds.map((userId) => rec({ userId })) };
}

function edgeRecords(...pairs: Array<[string, string]>) {
  return { records: pairs.map(([aId, bId]) => rec({ aId, bId })) };
}

const zeroMaintainStats = { clustersProcessed: 0, hubsCreated: 0, membersAttached: 0, hubsMerged: 0 };

describe('reconcileIdentityClusterHubs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run: mockRun });
    mockMaintainClusterHubs.mockResolvedValue({ ...zeroMaintainStats });
    mockGetHubIdsForMembers.mockResolvedValue(new Map());
    mockBulkCreateClusters.mockImplementation((clusters) => Promise.resolve(clusters.length));
  });

  it('is a no-op when every resolved node already has a hub', async () => {
    mockRun.mockResolvedValueOnce(userRecords());

    const stats = await reconcileIdentityClusterHubs();

    expect(stats).toEqual({
      usersReconciled: 0,
      clustersProcessed: 0,
      membersProcessed: 0,
      hubsCreated: 0,
      membersAttached: 0,
      hubsMerged: 0,
    });
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockBulkCreateClusters).not.toHaveBeenCalled();
    expect(mockMaintainClusterHubs).not.toHaveBeenCalled();
  });

  it('deploy day: derives components and bulk-creates them all, bypassing maintainClusterHubs', async () => {
    mockRun
      .mockResolvedValueOnce(userRecords('u1'))
      // A-B-C form one component (transitively), D-E another
      .mockResolvedValueOnce(edgeRecords(['A', 'B'], ['B', 'C'], ['D', 'E']));

    const stats = await reconcileIdentityClusterHubs();

    expect(mockBulkCreateClusters).toHaveBeenCalledTimes(1);
    const [clusters, userId] = mockBulkCreateClusters.mock.calls[0];
    expect(userId).toBe('u1');
    expect(clusters).toHaveLength(2);
    const byMember = (m: string) => (clusters as IdentityCluster[]).find((c) => c.memberIds.includes(m));
    expect(byMember('A')?.memberIds.sort()).toEqual(['A', 'B', 'C']);
    expect(byMember('A')?.representativeId).toBe('A');
    expect(byMember('D')?.memberIds.sort()).toEqual(['D', 'E']);

    expect(mockMaintainClusterHubs).not.toHaveBeenCalled();
    expect(stats.usersReconciled).toBe(1);
    expect(stats.clustersProcessed).toBe(2);
    expect(stats.membersProcessed).toBe(5);
    expect(stats.hubsCreated).toBe(2);
  });

  it('routes clusters touching existing hubs to maintainClusterHubs, the rest to bulk create', async () => {
    mockRun
      .mockResolvedValueOnce(userRecords('u1'))
      .mockResolvedValueOnce(edgeRecords(['A', 'B'], ['B', 'C'], ['D', 'E']));
    // Member B already belongs to a hub — its whole component must take the
    // attach/merge path, never bulk create.
    mockGetHubIdsForMembers.mockResolvedValue(new Map([['B', 'hub-1']]));
    mockMaintainClusterHubs.mockResolvedValue({
      clustersProcessed: 1, hubsCreated: 0, membersAttached: 2, hubsMerged: 0,
    });

    const stats = await reconcileIdentityClusterHubs();

    expect(mockBulkCreateClusters).toHaveBeenCalledTimes(1);
    const [bulkClusters] = mockBulkCreateClusters.mock.calls[0];
    expect(bulkClusters).toHaveLength(1);
    expect(bulkClusters[0].memberIds.sort()).toEqual(['D', 'E']);

    expect(mockMaintainClusterHubs).toHaveBeenCalledTimes(1);
    const [touchedClusters, touchedUserId] = mockMaintainClusterHubs.mock.calls[0];
    expect(touchedUserId).toBe('u1');
    expect(touchedClusters).toHaveLength(1);
    expect(touchedClusters[0].memberIds.sort()).toEqual(['A', 'B', 'C']);

    expect(stats.clustersProcessed).toBe(2);
    expect(stats.hubsCreated).toBe(1);
    expect(stats.membersAttached).toBe(2);
  });

  it('aggregates stats across users', async () => {
    mockRun
      .mockResolvedValueOnce(userRecords('u1', 'u2'))
      .mockResolvedValueOnce(edgeRecords(['A', 'B']))
      .mockResolvedValueOnce(edgeRecords(['X', 'Y'], ['Y', 'Z']));

    const stats = await reconcileIdentityClusterHubs();

    expect(mockBulkCreateClusters).toHaveBeenNthCalledWith(1, expect.any(Array), 'u1');
    expect(mockBulkCreateClusters).toHaveBeenNthCalledWith(2, expect.any(Array), 'u2');
    expect(stats).toEqual({
      usersReconciled: 2,
      clustersProcessed: 2,
      membersProcessed: 5,
      hubsCreated: 2,
      membersAttached: 0,
      hubsMerged: 0,
    });
  });

  it('skips a discovered user whose edges vanished before derivation', async () => {
    mockRun
      .mockResolvedValueOnce(userRecords('u1'))
      .mockResolvedValueOnce(edgeRecords());

    const stats = await reconcileIdentityClusterHubs();

    expect(mockBulkCreateClusters).not.toHaveBeenCalled();
    expect(mockMaintainClusterHubs).not.toHaveBeenCalled();
    expect(stats.usersReconciled).toBe(0);
  });

  it('propagates query failures to the caller', async () => {
    mockRun.mockRejectedValueOnce(new Error('neo4j down'));

    await expect(reconcileIdentityClusterHubs()).rejects.toThrow('neo4j down');
  });
});
