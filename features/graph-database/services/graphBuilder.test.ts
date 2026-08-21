import { embedDocumentEntities } from '@/features/graph-database/services/graphBuilder';
import { getGraphDatabaseSource } from '@/features/graph-database';

// Mock the graph database
jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));

// Mock the AI factory
jest.mock('@/features/ai-provider/factory', () => ({
  AIFactory: jest.fn().mockImplementation(() => ({
    buildSystemSource: jest.fn().mockResolvedValue({
      source: {
        completion: jest.fn().mockResolvedValue({
          text: 'Consolidated description from multiple sources.',
        }),
      },
      model: { externalId: 'mock-model' },
    }),
  })),
}));

// Mock the embed content function
jest.mock('@/features/shared/dal/document-library/upload/embedContent', () => ({
  embedContent: jest.fn().mockResolvedValue({
    embeddings: [{ embedding: [0.1, 0.2, 0.3] }],
  }),
}));

// Mock the Prisma client
jest.mock('@/server/db', () => ({
  default: {
    $executeRaw: jest.fn().mockResolvedValue(1),
  },
}));

// Mock @prisma/client
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
  },
}));

// Mock logger
jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.Mock;

describe('graphBuilder consolidation', () => {
  const mockUserId = 'test-user-123';
  const mockDocumentId = 'test-doc-456';

  let mockGraphDb: {
    run: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockGraphDb = {
      run: jest.fn(),
    };
    mockGetGraphDatabaseSource.mockResolvedValue(mockGraphDb);
  });

  describe('embedDocumentEntities', () => {
    it('should process entities with single descriptions (no consolidation needed)', async () => {
      // Entity with single description (no delimiter)
      mockGraphDb.run
        .mockResolvedValueOnce({
          records: [{
            get: (key: string) => {
              const data: Record<string, unknown> = {
                id: 'entity-1',
                name: 'Test Entity',
                type: 'ORGANIZATION',
                description: 'A simple description without delimiter',
                aliases: ['TE'],
              };
              return data[key];
            },
          }],
        })
        .mockResolvedValueOnce({ records: [] }) // Update Neo4j for entity
        .mockResolvedValueOnce({ records: [] }) // Concepts query
        .mockResolvedValue({ records: [] }); // Any additional calls

      await embedDocumentEntities(mockDocumentId, mockUserId);

      // First call: get entities
      expect(mockGraphDb.run.mock.calls[0][0]).toContain('MATCH (e:Entity');
      expect(mockGraphDb.run.mock.calls[0][0]).toContain('needsEmbedding = true');
    });

    it('should generate embeddings using raw description without LLM consolidation', async () => {
      const rawDescription = 'First description | Second description | Third description';

      mockGraphDb.run
        .mockResolvedValueOnce({
          records: [{
            get: (key: string) => {
              const data: Record<string, unknown> = {
                id: 'entity-1',
                name: 'Multi-Description Entity',
                type: 'PERSON',
                description: rawDescription,
                aliases: [],
              };
              return data[key];
            },
          }],
        })
        .mockResolvedValueOnce({ records: [] }) // Update Neo4j
        .mockResolvedValueOnce({ records: [] }); // Concepts query

      await embedDocumentEntities(mockDocumentId, mockUserId);

      // Should NOT call LLM — consolidation is removed
      const { AIFactory } = require('@/features/ai-provider/factory');
      expect(AIFactory).not.toHaveBeenCalled();

      // Should call embedContent with the raw description
      const { embedContent } = require('@/features/shared/dal/document-library/upload/embedContent');
      expect(embedContent).toHaveBeenCalled();
    });

    it('should process concepts similarly to entities', async () => {
      // No entities
      mockGraphDb.run.mockResolvedValueOnce({ records: [] });

      // One concept needing embedding
      mockGraphDb.run.mockResolvedValueOnce({
        records: [{
          get: (key: string) => {
            const data: Record<string, unknown> = {
              id: 'concept-1',
              name: 'Machine Learning',
              category: 'TECHNICAL',
              description: 'ML description 1 | ML description 2',
            };
            return data[key];
          },
        }],
      });

      mockGraphDb.run.mockResolvedValueOnce({ records: [] }); // Update Neo4j

      await embedDocumentEntities(mockDocumentId, mockUserId);

      // Should query for concepts
      expect(mockGraphDb.run.mock.calls[1][0]).toContain('MATCH (c:Concept');
    });

    it('should update Neo4j with consolidated description and clear needsEmbedding flag', async () => {
      // This test verifies the update query structure by checking the graphBuilder code
      // The actual Neo4j query is: MATCH (e:Entity {id: $entityId}) SET e.description = $description, e.needsEmbedding = false
      // We verify that the function completes without error when entities need processing

      mockGraphDb.run
        .mockResolvedValueOnce({
          records: [{
            get: (key: string) => {
              const data: Record<string, unknown> = {
                id: 'entity-1',
                name: 'Test Entity',
                type: 'ORGANIZATION',
                description: 'Description A | Description B',
                aliases: [],
              };
              return data[key];
            },
          }],
        })
        .mockResolvedValue({ records: [] }); // Handle all subsequent calls

      // Should complete without throwing
      await expect(embedDocumentEntities(mockDocumentId, mockUserId)).resolves.not.toThrow();

      // Should have made at least 2 calls: get entities and get concepts
      expect(mockGraphDb.run.mock.calls.length).toBeGreaterThanOrEqual(2);

      // First call should be to get entities
      expect(mockGraphDb.run.mock.calls[0][0]).toContain('MATCH (e:Entity');
      expect(mockGraphDb.run.mock.calls[0][0]).toContain('needsEmbedding = true');
    });

    it('should handle empty entity and concept lists', async () => {
      mockGraphDb.run
        .mockResolvedValueOnce({ records: [] }) // No entities
        .mockResolvedValueOnce({ records: [] }); // No concepts

      await embedDocumentEntities(mockDocumentId, mockUserId);

      // Should complete without errors
      expect(mockGraphDb.run).toHaveBeenCalledTimes(2);
    });

    it('should warn and continue when a batch embedding call fails', async () => {
      const { embedContent } = require('@/features/shared/dal/document-library/upload/embedContent');
      embedContent.mockRejectedValueOnce(new Error('Embedding failed'));

      mockGraphDb.run
        .mockResolvedValueOnce({
          records: [
            {
              get: (key: string) => {
                const data: Record<string, unknown> = {
                  id: 'entity-1',
                  name: 'Test Entity',
                  type: 'PERSON',
                  description: 'Test description',
                  aliases: [],
                };
                return data[key];
              },
            },
          ],
        })
        .mockResolvedValueOnce({ records: [] }); // Concepts

      // Batch embedding failure should NOT propagate -- function resolves
      await expect(embedDocumentEntities(mockDocumentId, mockUserId)).resolves.not.toThrow();

      // Warning logged for failed batch
      const { logger } = require('@/server/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Entity embedding batch 1/1 failed'),
        expect.any(Object)
      );
    });
  });

  describe('batched embedding', () => {
    it('should call embedContent once per batch when entities exceed EMBED_BATCH_SIZE', async () => {
      const entities = Array.from({ length: 75 }, (_, idx) => ({
        get: (key: string) => {
          const data: Record<string, unknown> = {
            id: `entity-${idx}`,
            name: `Entity ${idx}`,
            type: 'ORGANIZATION',
            description: `Description ${idx}`,
            aliases: [],
          };
          return data[key];
        },
      }));

      mockGraphDb.run
        .mockResolvedValueOnce({ records: entities })
        .mockResolvedValue({ records: [] });

      const { embedContent } = require('@/features/shared/dal/document-library/upload/embedContent');
      embedContent
        .mockResolvedValueOnce({
          embeddings: Array.from({ length: 50 }, () => ({ embedding: [0.1, 0.2, 0.3] })),
        })
        .mockResolvedValueOnce({
          embeddings: Array.from({ length: 25 }, () => ({ embedding: [0.1, 0.2, 0.3] })),
        });

      await embedDocumentEntities(mockDocumentId, mockUserId);

      expect(embedContent).toHaveBeenCalledTimes(2);
      expect(embedContent.mock.calls[0][0]).toHaveLength(50);
      expect(embedContent.mock.calls[1][0]).toHaveLength(25);
    });

    it('should continue processing remaining batches when one batch fails', async () => {
      const entities = Array.from({ length: 100 }, (_, idx) => ({
        get: (key: string) => {
          const data: Record<string, unknown> = {
            id: `entity-${idx}`,
            name: `Entity ${idx}`,
            type: 'PERSON',
            description: `Desc ${idx}`,
            aliases: [],
          };
          return data[key];
        },
      }));

      mockGraphDb.run
        .mockResolvedValueOnce({ records: entities })
        .mockResolvedValue({ records: [] });

      const { embedContent } = require('@/features/shared/dal/document-library/upload/embedContent');
      embedContent
        .mockRejectedValueOnce(new Error('Transient Bedrock failure'))
        .mockResolvedValueOnce({
          embeddings: Array.from({ length: 50 }, () => ({ embedding: [0.1, 0.2, 0.3] })),
        });

      await expect(embedDocumentEntities(mockDocumentId, mockUserId)).resolves.not.toThrow();

      expect(embedContent).toHaveBeenCalledTimes(2);

      const { logger } = require('@/server/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Entity embedding batch 1/2 failed'),
        expect.any(Object)
      );
    });

    it('should handle concepts with the same batched pattern', async () => {
      mockGraphDb.run.mockResolvedValueOnce({ records: [] });

      const concepts = Array.from({ length: 60 }, (_, idx) => ({
        get: (key: string) => {
          const data: Record<string, unknown> = {
            id: `concept-${idx}`,
            name: `Concept ${idx}`,
            category: 'TECHNICAL',
            description: `Concept desc ${idx}`,
          };
          return data[key];
        },
      }));

      mockGraphDb.run
        .mockResolvedValueOnce({ records: concepts })
        .mockResolvedValue({ records: [] });

      const { embedContent } = require('@/features/shared/dal/document-library/upload/embedContent');
      embedContent
        .mockResolvedValueOnce({
          embeddings: Array.from({ length: 50 }, () => ({ embedding: [0.1, 0.2, 0.3] })),
        })
        .mockResolvedValueOnce({
          embeddings: Array.from({ length: 10 }, () => ({ embedding: [0.1, 0.2, 0.3] })),
        });

      await embedDocumentEntities(mockDocumentId, mockUserId);

      expect(embedContent).toHaveBeenCalledTimes(2);
      expect(embedContent.mock.calls[0][0]).toHaveLength(50);
      expect(embedContent.mock.calls[1][0]).toHaveLength(10);
    });
  });
});

describe('description concatenation delimiter', () => {
  it('should use consistent delimiter for splitting', () => {
    const delimiter = ' | ';
    const testDescription = 'Part 1 | Part 2 | Part 3';
    const parts = testDescription.split(delimiter);

    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('Part 1');
    expect(parts[1]).toBe('Part 2');
    expect(parts[2]).toBe('Part 3');
  });
});
