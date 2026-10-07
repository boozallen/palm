import { getIdentityClusters } from '@/features/graph-database/dal/getIdentityClusters';
import { getGraphDatabaseSource } from '@/features/graph-database/factory';

jest.mock('@/features/graph-database/factory');
jest.mock('@/server/logger');

const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.MockedFunction<
  typeof getGraphDatabaseSource
>;

/** Build a mock graphDb whose run() returns the given (hubId, memberIds) rows. */
function mockHubs(rows: Array<{ hubId: string; memberIds: string[] }>) {
  const records = rows.map((row) => ({
    get: (field: string) => (field === 'hubId' ? row.hubId : row.memberIds),
  }));
  const mockGraphDb: any = {
    connect: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockResolvedValue({ records }),
  };
  mockGetGraphDatabaseSource.mockResolvedValue(mockGraphDb);
  return mockGraphDb;
}

describe('getIdentityClusters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns no clusters when there are no hubs', async () => {
    mockHubs([]);
    const clusters = await getIdentityClusters('user-1');
    expect(clusters).toEqual([]);
  });

  it('returns one cluster per hub, keyed by the hub id', async () => {
    mockHubs([{ hubId: 'hub-1', memberIds: ['e1', 'e2'] }]);
    const clusters = await getIdentityClusters('user-1');
    expect(clusters).toHaveLength(1);
    expect(clusters[0].representativeId).toBe('hub-1');
    expect([...clusters[0].memberIds].sort()).toEqual(['e1', 'e2']);
  });

  it('returns multiple independent hubs as separate clusters', async () => {
    mockHubs([
      { hubId: 'hub-1', memberIds: ['e1', 'e2', 'e3'] },
      { hubId: 'hub-2', memberIds: ['e4', 'e5'] },
    ]);
    const clusters = await getIdentityClusters('user-1');
    expect(clusters).toHaveLength(2);
    const sizes = clusters.map((c) => c.memberIds.length).sort();
    expect(sizes).toEqual([2, 3]);
  });

  it('scopes the query to the userId (isolation bound)', async () => {
    const mockGraphDb = mockHubs([{ hubId: 'hub-1', memberIds: ['e1', 'e2'] }]);
    await getIdentityClusters('user-1');
    expect(mockGraphDb.run).toHaveBeenCalledWith(
      expect.stringContaining('IdentityCluster {userId: $userId}'),
      { userId: 'user-1' }
    );
  });

  it('passes documentIds into the scoped query when provided', async () => {
    const mockGraphDb = mockHubs([{ hubId: 'hub-1', memberIds: ['e1', 'e2'] }]);
    await getIdentityClusters('user-1', ['doc-1', 'doc-2']);
    expect(mockGraphDb.run).toHaveBeenCalledWith(
      expect.stringContaining('m.documentId IN $documentIds'),
      expect.objectContaining({ userId: 'user-1', documentIds: ['doc-1', 'doc-2'] })
    );
  });

  it('omits documentIds from the query params when omitted', async () => {
    const mockGraphDb = mockHubs([{ hubId: 'hub-1', memberIds: ['e1', 'e2'] }]);
    await getIdentityClusters('user-1');
    const [, params] = mockGraphDb.run.mock.calls[0];
    expect(params).toEqual({ userId: 'user-1' });
  });
});
