import { logger } from '@/server/logger';
import deleteGraphNodes from './deleteGraphNodes';
import { getGraphDatabaseSource } from '@/features/graph-database';

jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

describe('deleteGraphNodes', () => {
  const mockGraphDb = {
    run: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphDb);
  });

  it('should delete all associated graph nodes successfully', async () => {
    const documentId = 'doc-123';
    mockGraphDb.run.mockResolvedValue(undefined);

    await deleteGraphNodes(documentId);

    expect(getGraphDatabaseSource).toHaveBeenCalled();
    expect(mockGraphDb.run).toHaveBeenCalledTimes(4);
    expect(logger.info).toHaveBeenCalledWith('Deleting graph nodes for document: doc-123');
    expect(logger.info).toHaveBeenCalledWith('Successfully deleted graph nodes for document: doc-123');
  });

  it('should handle errors when deleting graph nodes', async () => {
    const documentId = 'doc-123';
    const error = new Error('Graph database error');
    mockGraphDb.run.mockRejectedValue(error);

    await expect(deleteGraphNodes(documentId)).rejects.toThrow('Error deleting graph nodes');
    expect(logger.error).toHaveBeenCalledWith('Error deleting graph nodes for document doc-123:', error);
  });

  it('should handle errors when getting graph database source', async () => {
    const documentId = 'doc-123';
    const error = new Error('Database connection error');
    (getGraphDatabaseSource as jest.Mock).mockRejectedValue(error);

    await expect(deleteGraphNodes(documentId)).rejects.toThrow('Error deleting graph nodes');
    expect(logger.error).toHaveBeenCalledWith('Error deleting graph nodes for document doc-123:', error);
  });

  it('should use batched cypher queries to delete all node types', async () => {
    const documentId = 'test-document-id';
    mockGraphDb.run.mockResolvedValue(undefined);

    await deleteGraphNodes(documentId);

    expect(mockGraphDb.run).toHaveBeenCalledTimes(4);

    const calls = (mockGraphDb.run as jest.Mock).mock.calls;
    expect(calls[0][0]).toContain('MATCH (e:Entity {documentId: $documentId})');
    expect(calls[0][0]).toContain('IN TRANSACTIONS OF 1000 ROWS');
    expect(calls[1][0]).toContain('MATCH (con:Concept {documentId: $documentId})');
    expect(calls[1][0]).toContain('IN TRANSACTIONS OF 1000 ROWS');
    expect(calls[2][0]).toContain('MATCH (d:Document {id: $documentId})-[:CONTAINS]->(c:Chunk)');
    expect(calls[2][0]).toContain('IN TRANSACTIONS OF 1000 ROWS');
    expect(calls[3][0]).toContain('MATCH (d:Document {id: $documentId}) DETACH DELETE d');
  });

});
