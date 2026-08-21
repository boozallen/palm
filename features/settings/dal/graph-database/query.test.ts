import { getGraphDatabaseSource } from '@/features/graph-database';
import query from './query';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

const mockSession = {
  run: jest.fn(),
  close: jest.fn(),
};

const mockGraphSource = {
  getSession: jest.fn().mockResolvedValue(mockSession),
};

(getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphSource);

describe('query', () => {
  beforeEach(jest.clearAllMocks);

  it('should execute a read query and return results', async () => {
    mockGraphSource.getSession.mockResolvedValue(mockSession);
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphSource);
    mockSession.run.mockResolvedValue({
      records: [
        {
          keys: ['name', 'age'],
          get: (key: string) => (key === 'name' ? 'Alice' : 30),
        },
      ],
      summary: { resultAvailableAfter: 5 },
    });

    const result = await query({ query: 'MATCH (n) RETURN n', allowWrite: false });

    expect(mockSession.run).toHaveBeenCalledWith('MATCH (n) RETURN n');
    expect(mockSession.close).toHaveBeenCalled();
    expect(result).toEqual({
      results: [{ name: 'Alice', age: 30 }],
      recordCount: 1,
      summary: {
        queryType: 'read',
        executionTime: 5,
      },
    });
  });

  it('should handle executionTime as Neo4j Integer with toNumber()', async () => {
    mockGraphSource.getSession.mockResolvedValue(mockSession);
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphSource);
    mockSession.run.mockResolvedValue({
      records: [],
      summary: { resultAvailableAfter: { toNumber: () => 42 } },
    });

    const result = await query({ query: 'MATCH (n) RETURN n', allowWrite: false });

    expect(result.summary.executionTime).toBe(42);
  });

  it('should block write operations when allowWrite is false', async () => {
    await expect(
      query({ query: 'CREATE (n:Person {name: "Bob"})', allowWrite: false }),
    ).rejects.toThrow('Write operations are not allowed');

    expect(mockSession.run).not.toHaveBeenCalled();
  });

  it.each([
    'CREATE (n:Node)',
    'MERGE (n:Node)',
    'DELETE n',
    'REMOVE n.prop',
    'SET n.prop = 1',
    'DETACH DELETE n',
    'DROP CONSTRAINT',
    'LOAD CSV FROM "file"',
  ])('should block write operation: %s', async (writeQuery) => {
    await expect(query({ query: writeQuery, allowWrite: false })).rejects.toThrow(
      'Write operations are not allowed',
    );
  });

  it('should allow write operations when allowWrite is true', async () => {
    mockGraphSource.getSession.mockResolvedValue(mockSession);
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphSource);
    mockSession.run.mockResolvedValue({
      records: [],
      summary: { resultAvailableAfter: 1 },
    });

    const result = await query({
      query: 'CREATE (n:Person {name: "Bob"})',
      allowWrite: true,
    });

    expect(mockSession.run).toHaveBeenCalledWith('CREATE (n:Person {name: "Bob"})');
    expect(result.summary.queryType).toBe('write');
  });

  it('should close the session even if the query fails', async () => {
    mockGraphSource.getSession.mockResolvedValue(mockSession);
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphSource);
    mockSession.run.mockRejectedValue(new Error('Neo4j error'));

    await expect(query({ query: 'MATCH (n) RETURN n', allowWrite: false })).rejects.toThrow(
      'Error executing graph search query',
    );

    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should return empty results for a query with no records', async () => {
    mockGraphSource.getSession.mockResolvedValue(mockSession);
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphSource);
    mockSession.run.mockResolvedValue({
      records: [],
      summary: { resultAvailableAfter: 0 },
    });

    const result = await query({ query: 'MATCH (n:NonExistent) RETURN n', allowWrite: false });

    expect(result.recordCount).toBe(0);
    expect(result.results).toEqual([]);
  });

  it('should be case-insensitive when detecting write operations', async () => {
    await expect(
      query({ query: 'CREATE (n:Node)', allowWrite: false }),
    ).rejects.toThrow('Write operations are not allowed');

    await expect(
      query({ query: '  CrEaTe (n:Node)  ', allowWrite: false }),
    ).rejects.toThrow('Write operations are not allowed');
  });
});
