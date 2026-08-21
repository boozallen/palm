import {
  markDocumentPairResolved,
  isDocumentPairResolved,
  getUnresolvedDocumentIds,
  getResolvedPairsForUser,
  getResolvedPairCount,
  deleteResolutionPairsForDocument,
} from '@/features/graph-database/dal/documentResolutionPairs';

// Mock the Prisma client
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    documentResolutionPair: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock the logger
jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import db from '@/server/db';

const mockDb = db as jest.Mocked<typeof db>;

describe('documentResolutionPairs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('markDocumentPairResolved', () => {
    it('should create a resolution pair with canonical ordering (smaller UUID first)', async () => {
      (mockDb.documentResolutionPair.upsert as jest.Mock).mockResolvedValue({});

      // Pass doc2 before doc1 (alphabetically)
      await markDocumentPairResolved({
        document1Id: 'zzz-doc-2',
        document2Id: 'aaa-doc-1',
        userId: 'user-123',
        candidatesGenerated: 10,
        identityEdgesCreated: 3,
        similarEdgesCreated: 2,
        relatedEdgesCreated: 1,
      });

      // Should swap to canonical order
      expect(mockDb.documentResolutionPair.upsert).toHaveBeenCalledWith({
        where: {
          document1Id_document2Id: {
            document1Id: 'aaa-doc-1', // smaller first
            document2Id: 'zzz-doc-2',
          },
        },
        update: expect.objectContaining({
          candidatesGenerated: 10,
        }),
        create: expect.objectContaining({
          document1Id: 'aaa-doc-1',
          document2Id: 'zzz-doc-2',
          userId: 'user-123',
        }),
      });
    });

    it('should maintain order when already canonical', async () => {
      (mockDb.documentResolutionPair.upsert as jest.Mock).mockResolvedValue({});

      await markDocumentPairResolved({
        document1Id: 'aaa-doc-1',
        document2Id: 'zzz-doc-2',
        userId: 'user-123',
        candidatesGenerated: 5,
        identityEdgesCreated: 1,
        similarEdgesCreated: 0,
        relatedEdgesCreated: 0,
      });

      expect(mockDb.documentResolutionPair.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            document1Id_document2Id: {
              document1Id: 'aaa-doc-1',
              document2Id: 'zzz-doc-2',
            },
          },
        })
      );
    });

    it('should throw on database error', async () => {
      (mockDb.documentResolutionPair.upsert as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(markDocumentPairResolved({
        document1Id: 'doc-1',
        document2Id: 'doc-2',
        userId: 'user-123',
        candidatesGenerated: 0,
        identityEdgesCreated: 0,
        similarEdgesCreated: 0,
        relatedEdgesCreated: 0,
      })).rejects.toThrow('Failed to mark document pair as resolved');
    });
  });

  describe('isDocumentPairResolved', () => {
    it('should return true if pair exists', async () => {
      (mockDb.documentResolutionPair.findUnique as jest.Mock).mockResolvedValue({
        document1Id: 'aaa-doc-1',
        document2Id: 'zzz-doc-2',
      });

      const result = await isDocumentPairResolved('zzz-doc-2', 'aaa-doc-1');

      expect(result).toBe(true);
      // Should have queried with canonical order
      expect(mockDb.documentResolutionPair.findUnique).toHaveBeenCalledWith({
        where: {
          document1Id_document2Id: {
            document1Id: 'aaa-doc-1',
            document2Id: 'zzz-doc-2',
          },
        },
      });
    });

    it('should return false if pair does not exist', async () => {
      (mockDb.documentResolutionPair.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await isDocumentPairResolved('doc-1', 'doc-2');

      expect(result).toBe(false);
    });
  });

  describe('getUnresolvedDocumentIds', () => {
    it('should return documents not yet resolved against new document', async () => {
      // Already resolved pairs involving 'new-doc'
      (mockDb.documentResolutionPair.findMany as jest.Mock).mockResolvedValue([
        { document1Id: 'existing-doc-1', document2Id: 'new-doc' },
        { document1Id: 'existing-doc-2', document2Id: 'new-doc' },
      ]);

      const result = await getUnresolvedDocumentIds(
        'user-123',
        'new-doc',
        ['existing-doc-1', 'existing-doc-2', 'existing-doc-3', 'existing-doc-4']
      );

      // existing-doc-3 and existing-doc-4 are not in the resolved pairs
      expect(result).toContain('existing-doc-3');
      expect(result).toContain('existing-doc-4');
      expect(result).not.toContain('existing-doc-1');
      expect(result).not.toContain('existing-doc-2');
    });

    it('should return all documents if none are resolved', async () => {
      (mockDb.documentResolutionPair.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getUnresolvedDocumentIds(
        'user-123',
        'new-doc',
        ['doc-1', 'doc-2', 'doc-3']
      );

      expect(result).toEqual(['doc-1', 'doc-2', 'doc-3']);
    });

    it('should return empty array if all are resolved', async () => {
      (mockDb.documentResolutionPair.findMany as jest.Mock).mockResolvedValue([
        { document1Id: 'doc-1', document2Id: 'new-doc' },
        { document1Id: 'doc-2', document2Id: 'new-doc' },
      ]);

      const result = await getUnresolvedDocumentIds(
        'user-123',
        'new-doc',
        ['doc-1', 'doc-2']
      );

      expect(result).toEqual([]);
    });

    it('should return empty array if existingDocIds is empty', async () => {
      const result = await getUnresolvedDocumentIds(
        'user-123',
        'new-doc',
        []
      );

      expect(result).toEqual([]);
      expect(mockDb.documentResolutionPair.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getResolvedPairsForUser', () => {
    it('should return all resolved pairs for a user', async () => {
      const mockPairs = [
        {
          document1Id: 'doc-1',
          document2Id: 'doc-2',
          resolvedAt: new Date(),
          candidatesGenerated: 10,
          identityEdgesCreated: 3,
          similarEdgesCreated: 2,
          relatedEdgesCreated: 1,
        },
      ];
      (mockDb.documentResolutionPair.findMany as jest.Mock).mockResolvedValue(mockPairs);

      const result = await getResolvedPairsForUser('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].document1Id).toBe('doc-1');
      expect(mockDb.documentResolutionPair.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { resolvedAt: 'desc' },
        take: 100,
      });
    });

    it('should respect limit parameter', async () => {
      (mockDb.documentResolutionPair.findMany as jest.Mock).mockResolvedValue([]);

      await getResolvedPairsForUser('user-123', 50);

      expect(mockDb.documentResolutionPair.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { resolvedAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('getResolvedPairCount', () => {
    it('should return count of resolved pairs for user', async () => {
      (mockDb.documentResolutionPair.count as jest.Mock).mockResolvedValue(15);

      const result = await getResolvedPairCount('user-123');

      expect(result).toBe(15);
      expect(mockDb.documentResolutionPair.count).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });

  describe('deleteResolutionPairsForDocument', () => {
    it('should delete pairs involving the document', async () => {
      (mockDb.documentResolutionPair.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await deleteResolutionPairsForDocument('doc-123');

      expect(result).toBe(5);
      expect(mockDb.documentResolutionPair.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { document1Id: 'doc-123' },
            { document2Id: 'doc-123' },
          ],
        },
      });
    });
  });
});
