import { getExtractedDocumentIds } from '@/features/graph-database/dal/getExtractedDocumentIds';
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

describe('getExtractedDocumentIds', () => {
  let mockGraphDb: { run: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGraphDb = { run: jest.fn().mockResolvedValue({ records: [] }) };
    mockGetGraphDatabaseSource.mockResolvedValue(mockGraphDb);
  });

  it('returns the ids of extraction-complete documents', async () => {
    mockGraphDb.run.mockResolvedValueOnce({
      records: [makeRecord({ id: 'doc-1' }), makeRecord({ id: 'doc-2' })],
    });

    const ids = await getExtractedDocumentIds('user-1');

    expect(ids).toEqual(['doc-1', 'doc-2']);
  });

  it('returns an empty array when no documents are extracted', async () => {
    mockGraphDb.run.mockResolvedValueOnce({ records: [] });

    const ids = await getExtractedDocumentIds('user-1');

    expect(ids).toEqual([]);
  });

  it('scopes the query by userId and requires the extraction marker only', async () => {
    await getExtractedDocumentIds('user-42');

    const [query, params] = mockGraphDb.run.mock.calls[0];
    expect(query).toContain('Document {userId: $userId}');
    expect(params).toEqual({ userId: 'user-42' });
    expect(query).toContain('coalesce(d.extractionComplete, false) = true');
    // Must NOT require resolution-complete — that would hide extracted-but-unresolved docs
    expect(query).not.toContain('resolutionComplete');
  });

  it('throws a sanitized error when the graph query fails', async () => {
    mockGraphDb.run.mockRejectedValueOnce(new Error('neo4j down'));

    await expect(getExtractedDocumentIds('user-1')).rejects.toThrow('Failed to fetch extracted documents');
  });
});
