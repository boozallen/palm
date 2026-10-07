import { persistResolutions } from '@/features/graph-database/services/resolutionExecutor';
import type { Entity, Resolution } from '@/features/graph-database/types';
import { getGraphDatabaseSource } from '@/features/graph-database/factory';

// Mock dependencies
jest.mock('../factory');
jest.mock('@/server/logger');

const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.MockedFunction<typeof getGraphDatabaseSource>;

// Note: context is now on MENTIONS edge, not on Entity node
const mockEntity1: Entity = {
  id: 'entity-1',
  name: 'DHA',
  type: 'ORGANIZATION',
  normalizedName: 'dha',
  description: 'Defense Health Agency',
  aliases: ['Defense Health Agency'],
  mentionCount: 5,
  firstSeenAt: new Date('2024-01-01'),
  documentId: 'doc-1',
};

const mockEntity2: Entity = {
  id: 'entity-2',
  name: 'Defense Health Agency',
  type: 'ORGANIZATION',
  normalizedName: 'defense health agency',
  description: 'Military healthcare provider',
  aliases: ['DHA'],
  mentionCount: 3,
  firstSeenAt: new Date('2024-01-02'),
  documentId: 'doc-1',
};

describe('resolutionExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('persistResolutions', () => {
    it('should persist IDENTITY edge to Neo4j', async () => {
      const mockResolution: Resolution = {
        entity1: mockEntity1,
        entity2: mockEntity2,
        edgeType: 'IDENTITY',
        confidence: 0.95,
        rationale: 'Same entity',
        decidedBy: 'llm',
        signals: {
          cosineSimScore: 0.95,
          sharedAliases: ['dha'],
          sharedDoc: true,
        },
        policy: 'default',
        policyVersion: '2025-01-19',
        resolvedAt: new Date('2024-01-01'),
      };

      const mockGraphDb: any = { connect: jest.fn().mockResolvedValue(undefined), run: jest.fn() };
      mockGetGraphDatabaseSource.mockResolvedValue(mockGraphDb);
      mockGraphDb.connect = jest.fn().mockResolvedValue(undefined);
      mockGraphDb.run = jest.fn().mockResolvedValue(undefined);

      await persistResolutions([mockResolution]);

      expect(mockGraphDb.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (n1)-[r:IDENTITY]-(n2)'),
        expect.objectContaining({
          e1Id: 'entity-1',
          e2Id: 'entity-2',
          confidence: 0.95,
        })
      );
    });

    it('should map RELATED_RESOLUTION to RELATED in Neo4j', async () => {
      const mockResolution: Resolution = {
        entity1: mockEntity1,
        entity2: mockEntity2,
        edgeType: 'RELATED_RESOLUTION',
        confidence: 0.85,
        rationale: 'Related entities',
        decidedBy: 'llm',
        signals: {
          cosineSimScore: 0.85,
          sharedAliases: [],
          sharedDoc: false,
        },
        policy: 'default',
        policyVersion: '2025-01-19',
        resolvedAt: new Date('2024-01-01'),
      };

      const mockGraphDb: any = { connect: jest.fn().mockResolvedValue(undefined), run: jest.fn() };
      mockGetGraphDatabaseSource.mockResolvedValue(mockGraphDb);
      mockGraphDb.connect = jest.fn().mockResolvedValue(undefined);
      mockGraphDb.run = jest.fn().mockResolvedValue(undefined);

      await persistResolutions([mockResolution]);

      expect(mockGraphDb.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (n1)-[r:RELATED]-(n2)'),
        expect.any(Object)
      );
    });

    it('should continue on individual edge creation failures', async () => {
      const mockResolutions: Resolution[] = [
        {
          entity1: mockEntity1,
          entity2: mockEntity2,
          edgeType: 'IDENTITY',
          confidence: 0.95,
          rationale: 'Same entity',
          decidedBy: 'llm',
          signals: { cosineSimScore: 0.95, sharedDoc: true },
          policy: 'default',
          policyVersion: '2025-01-19',
          resolvedAt: new Date(),
        },
        {
          entity1: mockEntity1,
          entity2: mockEntity2,
          edgeType: 'RELATED_RESOLUTION',
          confidence: 0.85,
          rationale: 'Related',
          decidedBy: 'llm',
          signals: { cosineSimScore: 0.85, sharedDoc: false },
          policy: 'default',
          policyVersion: '2025-01-19',
          resolvedAt: new Date(),
        },
      ];

      const mockGraphDb: any = { connect: jest.fn().mockResolvedValue(undefined), run: jest.fn() };
      mockGetGraphDatabaseSource.mockResolvedValue(mockGraphDb);
      mockGraphDb.connect = jest.fn().mockResolvedValue(undefined);
      mockGraphDb.run = jest
        .fn()
        .mockRejectedValueOnce(new Error('Neo4j error'))
        .mockResolvedValueOnce(undefined);

      await persistResolutions(mockResolutions);

      expect(mockGraphDb.run).toHaveBeenCalledTimes(2);
    });
  });
});
