import { getResolvedDocumentIds } from '@/features/graph-database/dal/getResolvedDocumentIds';
import { getGraphDatabaseSource } from '@/features/graph-database';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.Mock;

const makeRecord = (data: Record<string, unknown>) => ({
  get: (key: string) => data[key],
});

describe('getResolvedDocumentIds', () => {
  let mockGraphDb: { run: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGraphDb = { run: jest.fn().mockResolvedValue({ records: [] }) };
    mockGetGraphDatabaseSource.mockResolvedValue(mockGraphDb);
  });

  it('returns the ids of resolution-complete documents', async () => {
    mockGraphDb.run.mockResolvedValueOnce({
      records: [makeRecord({ id: 'doc-1' }), makeRecord({ id: 'doc-2' })],
    });

    const ids = await getResolvedDocumentIds('user-1');

    expect(ids).toEqual(['doc-1', 'doc-2']);
  });

  it('returns an empty array when no documents are resolved', async () => {
    mockGraphDb.run.mockResolvedValueOnce({ records: [] });

    const ids = await getResolvedDocumentIds('user-1');

    expect(ids).toEqual([]);
  });

  it('scopes the query strictly by userId and requires both markers', async () => {
    await getResolvedDocumentIds('user-42');

    const [query, params] = mockGraphDb.run.mock.calls[0];
    // Scoped by userId
    expect(query).toContain('Document {userId: $userId}');
    expect(params).toEqual({ userId: 'user-42' });
    // Requires extraction AND resolution complete (unset coalesces to false)
    expect(query).toContain('coalesce(d.extractionComplete, false) = true');
    expect(query).toContain('coalesce(d.resolutionComplete, false) = true');
  });

  it('throws a sanitized error when the graph query fails', async () => {
    mockGraphDb.run.mockRejectedValueOnce(new Error('neo4j down'));

    await expect(getResolvedDocumentIds('user-1')).rejects.toThrow('Failed to fetch resolved documents');
  });
});
