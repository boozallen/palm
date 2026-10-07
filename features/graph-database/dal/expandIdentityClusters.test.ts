import { expandIdentityClusters } from '@/features/graph-database/dal/expandIdentityClusters';
import { getGraphDatabaseSource } from '@/features/graph-database/factory';

jest.mock('@/features/graph-database/factory');
jest.mock('@/server/logger');

const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.MockedFunction<
  typeof getGraphDatabaseSource
>;

/** Build a mock graphDb whose run() returns the given seedId -> clusterIds rows. */
function mockClusters(rows: Array<{ seedId: string; clusterIds: string[] }>) {
  const records = rows.map((row) => ({
    get: (field: string) => (field === 'seedId' ? row.seedId : row.clusterIds),
  }));
  const mockGraphDb: any = {
    connect: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockResolvedValue({ records }),
  };
  mockGetGraphDatabaseSource.mockResolvedValue(mockGraphDb);
  return mockGraphDb;
}

describe('expandIdentityClusters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('short-circuits with an empty map and no DB call when nodeIds is empty', async () => {
    const mockGraphDb = mockClusters([]);
    const result = await expandIdentityClusters([], ['doc-1']);
    expect(result).toEqual(new Map());
    expect(mockGraphDb.run).not.toHaveBeenCalled();
  });

  it('maps a seed with no IDENTITY edges to itself', async () => {
    mockClusters([{ seedId: 'e1', clusterIds: ['e1'] }]);
    const result = await expandIdentityClusters(['e1'], ['doc-1']);
    expect(result.get('e1')).toEqual(['e1']);
  });

  it('maps a seed in a 3-member cluster to all 3 members, seed included', async () => {
    mockClusters([{ seedId: 'e1', clusterIds: ['e1', 'e2', 'e3'] }]);
    const result = await expandIdentityClusters(['e1'], ['doc-1', 'doc-2', 'doc-3']);
    expect(result.get('e1')?.sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('excludes cluster members outside the caller documentIds (filter applied server-side)', async () => {
    // Simulates the DB-side WHERE alias.documentId IN $documentIds filter
    // having already dropped the out-of-scope member before the row is returned.
    const mockGraphDb = mockClusters([{ seedId: 'e1', clusterIds: ['e1', 'e2'] }]);
    const result = await expandIdentityClusters(['e1'], ['doc-1']);

    expect(result.get('e1')).toEqual(['e1', 'e2']);
    expect(mockGraphDb.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ documentIds: ['doc-1'] })
    );
  });

  it('gives multiple seeds in the same cluster each the full cluster membership', async () => {
    mockClusters([
      { seedId: 'e1', clusterIds: ['e1', 'e2', 'e3'] },
      { seedId: 'e2', clusterIds: ['e1', 'e2', 'e3'] },
    ]);
    const result = await expandIdentityClusters(['e1', 'e2'], ['doc-1']);
    expect(result.get('e1')?.sort()).toEqual(['e1', 'e2', 'e3']);
    expect(result.get('e2')?.sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('falls back to [seedId] for a seed missing from the result rows', async () => {
    // A seed whose node no longer exists, or whose document is outside the
    // caller's documentIds, never matches the MATCH clause, so no row comes
    // back and it gets no expansion.
    mockClusters([{ seedId: 'e1', clusterIds: ['e1'] }]);
    const result = await expandIdentityClusters(['e1', 'e2'], ['doc-1']);
    expect(result.get('e1')).toEqual(['e1']);
    expect(result.get('e2')).toEqual(['e2']);
  });

  it('scopes the seed node itself by documentIds, not just cluster members', async () => {
    const mockGraphDb = mockClusters([]);
    await expandIdentityClusters(['e1'], ['doc-1']);

    // Pins the access wall on the seed match: expanding an out-of-scope seed
    // would confirm which accessible entities an untrusted id resolves to.
    const [query] = mockGraphDb.run.mock.calls[0];
    expect(query).toContain('WHERE n.documentId IN $documentIds');
  });

  it('passes nodeIds and documentIds as query parameters', async () => {
    const mockGraphDb = mockClusters([{ seedId: 'e1', clusterIds: ['e1'] }]);
    await expandIdentityClusters(['e1'], ['doc-1', 'doc-2']);
    expect(mockGraphDb.run).toHaveBeenCalledWith(expect.any(String), {
      nodeIds: ['e1'],
      documentIds: ['doc-1', 'doc-2'],
    });
  });

  it('throws a sanitized error when the query fails', async () => {
    const mockGraphDb: any = {
      connect: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockRejectedValue(new Error('connection reset')),
    };
    mockGetGraphDatabaseSource.mockResolvedValue(mockGraphDb);

    await expect(expandIdentityClusters(['e1'], ['doc-1'])).rejects.toThrow(
      'Failed to expand identity clusters'
    );
  });
});
