import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import createEmbeddings from '@/features/shared/dal/document-library/upload/createEmbeddings';
import db from '@/server/db';
import logger from '@/server/logger';
import { TextChunk } from '@/features/document-upload-provider/sources/types';

jest.mock('@/server/db');
jest.mock('@/server/logger');
jest.mock('crypto');
jest.mock('@prisma/client');

const mockDb = db as jest.Mocked<typeof db>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockRandomUUID = randomUUID as jest.MockedFunction<typeof randomUUID>;

describe('createEmbeddings', () => {
  const mockDocumentId = '123e4567-e89b-12d3-a456-426614174000';
  const mockEmbeddings = [
    { embedding: [0.1, 0.2, 0.3] },
    { embedding: [0.4, 0.5, 0.6] },
  ];
  const mockChunks: TextChunk[] = [
    {
      content: 'First chunk content',
      index: 0,
      tokenCount: 10,
      startPosition: 0,
      endPosition: 19,
      sectionPath: ['Section', 'Subsection'],
      pageStart: 2,
      pageEnd: 4,
    },
    { content: 'Second chunk content', index: 1, tokenCount: 15, startPosition: 19, endPosition: 39 },
  ];

  const mockUUIDs = [
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002',
  ];

  let mockTransaction: jest.Mock;
  let mockExecuteRaw: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRandomUUID
      .mockReturnValueOnce(mockUUIDs[0] as `${string}-${string}-${string}-${string}-${string}`)
      .mockReturnValueOnce(mockUUIDs[1] as `${string}-${string}-${string}-${string}-${string}`);

    mockExecuteRaw = jest.fn().mockResolvedValue(undefined);
    mockTransaction = jest.fn().mockImplementation((callback, _options) => {
      const tx = { $executeRaw: mockExecuteRaw };
      return callback(tx);
    });
    mockDb.$transaction = mockTransaction;

    (Prisma.sql as any) = jest.fn().mockImplementation((strings, ...values) => ({
      strings,
      values,
      sql: strings.join('?'),
    }));

    (Prisma.join as any) = jest.fn().mockImplementation((arr) => ({
      values: arr,
      sql: arr.map(() => '?').join(', '),
    }));
  });

  describe('successful scenarios', () => {
    it('should successfully create embeddings and return count', async () => {
      const result = await createEmbeddings({
        embeddings: mockEmbeddings,
        chunks: mockChunks,
        documentId: mockDocumentId,
      });

      expect(result).toEqual({ count: 2 });
      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 60000 });
      expect(mockExecuteRaw).toHaveBeenCalledTimes(1); // Single batch insert
      expect(mockRandomUUID).toHaveBeenCalledTimes(2);
    });

    it('should generate unique UUIDs for each embedding', async () => {
      await createEmbeddings({
        embeddings: mockEmbeddings,
        chunks: mockChunks,
        documentId: mockDocumentId,
      });

      expect(mockRandomUUID).toHaveBeenCalledTimes(2);
      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    });

    it('should execute correct SQL for batch insert', async () => {
      await createEmbeddings({
        embeddings: mockEmbeddings,
        chunks: mockChunks,
        documentId: mockDocumentId,
      });

      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
      expect(mockExecuteRaw).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('INSERT INTO "Embedding"'),
      }));
      expect(Prisma.join).toHaveBeenCalled();
    });

    it('should handle single embedding/chunk pair', async () => {
      const singleEmbedding = [{ embedding: [0.1, 0.2, 0.3] }];
      const singleChunk = [{ content: 'Single chunk', index: 0, tokenCount: 5, startPosition: 0, endPosition: 12 }];

      const result = await createEmbeddings({
        embeddings: singleEmbedding,
        chunks: singleChunk,
        documentId: mockDocumentId,
      });

      expect(result).toEqual({ count: 1 });
      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
      expect(mockRandomUUID).toHaveBeenCalledTimes(1);
    });

    it('should include section and page metadata and default missing values', async () => {
      await createEmbeddings({
        embeddings: mockEmbeddings,
        chunks: mockChunks,
        documentId: mockDocumentId,
      });

      const rowCalls = (Prisma.sql as jest.Mock).mock.calls.filter(
        (call) => call[0]?.length === 11 && call[0][0] === '(',
      );
      expect(rowCalls).toHaveLength(2);
      expect(rowCalls[0][7].values).toEqual([['Section', 'Subsection']]);
      expect(rowCalls[0].slice(8, 10)).toEqual([2, 4]);
      expect(rowCalls[1][7].values).toEqual([[]]);
      expect(rowCalls[1].slice(8, 10)).toEqual([null, null]);
      expect(Prisma.sql).toHaveBeenCalledWith(
        expect.arrayContaining(['', '::text[]']),
        ['Section', 'Subsection'],
      );
      expect(Prisma.sql).toHaveBeenCalledWith(
        expect.arrayContaining(['', '::text[]']),
        [],
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty arrays', async () => {
      const result = await createEmbeddings({
        embeddings: [],
        chunks: [],
        documentId: mockDocumentId,
      });

      expect(result).toEqual({ count: 0 });
      expect(mockExecuteRaw).not.toHaveBeenCalled();
      expect(mockRandomUUID).not.toHaveBeenCalled();
    });

    it('should fail with mismatched array lengths (more embeddings than chunks)', async () => {
      const moreEmbeddings = [
        { embedding: [0.1, 0.2, 0.3] },
        { embedding: [0.4, 0.5, 0.6] },
        { embedding: [0.7, 0.8, 0.9] },
      ];
      const fewerChunks = [
        { content: 'First chunk', index: 0, tokenCount: 10, startPosition: 0, endPosition: 11 },
        { content: 'Second chunk', index: 1, tokenCount: 15, startPosition: 11, endPosition: 23 },
      ];

      mockRandomUUID
        .mockReturnValueOnce('550e8400-e29b-41d4-a716-446655440003')
        .mockReturnValueOnce('550e8400-e29b-41d4-a716-446655440004')
        .mockReturnValueOnce('550e8400-e29b-41d4-a716-446655440005');

      await expect(
        createEmbeddings({
          embeddings: moreEmbeddings,
          chunks: fewerChunks,
          documentId: mockDocumentId,
        })
      ).rejects.toThrow('There was a problem creating the embeddings');

      expect(mockLogger.error).toHaveBeenCalledWith(
        `There was a problem creating embeddings for document ${mockDocumentId}`,
        expect.any(Error)
      );
    });
  });

  describe('error handling', () => {
    it('should handle database transaction failure', async () => {
      const dbError = new Error('Database connection failed');
      mockTransaction.mockRejectedValue(dbError);

      await expect(
        createEmbeddings({
          embeddings: mockEmbeddings,
          chunks: mockChunks,
          documentId: mockDocumentId,
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle $executeRaw failure and log error', async () => {
      const sqlError = new Error('SQL execution failed');
      mockExecuteRaw.mockRejectedValue(sqlError);

      await expect(
        createEmbeddings({
          embeddings: mockEmbeddings,
          chunks: mockChunks,
          documentId: mockDocumentId,
        })
      ).rejects.toThrow('There was a problem creating the embeddings');

      expect(mockLogger.error).toHaveBeenCalledWith(
        `There was a problem creating embeddings for document ${mockDocumentId}`,
        sqlError
      );
    });

    it('should log error with correct document ID', async () => {
      const customDocumentId = 'custom-doc-id-456';
      const error = new Error('Test error');
      mockExecuteRaw.mockRejectedValue(error);

      await expect(
        createEmbeddings({
          embeddings: mockEmbeddings,
          chunks: mockChunks,
          documentId: customDocumentId,
        })
      ).rejects.toThrow('There was a problem creating the embeddings');

      expect(mockLogger.error).toHaveBeenCalledWith(
        `There was a problem creating embeddings for document ${customDocumentId}`,
        error
      );
    });

    it('should throw generic error message on failure', async () => {
      mockExecuteRaw.mockRejectedValue(new Error('Specific DB error'));

      await expect(
        createEmbeddings({
          embeddings: mockEmbeddings,
          chunks: mockChunks,
          documentId: mockDocumentId,
        })
      ).rejects.toThrow('There was a problem creating the embeddings');

      await expect(
        createEmbeddings({
          embeddings: mockEmbeddings,
          chunks: mockChunks,
          documentId: mockDocumentId,
        })
      ).rejects.not.toThrow('Specific DB error');
    });

    it('should handle UUID generation failure', async () => {
      mockRandomUUID.mockReset();
      mockRandomUUID.mockImplementation(() => {
        throw new Error('UUID generation failed');
      });

      await expect(
        createEmbeddings({
          embeddings: mockEmbeddings,
          chunks: mockChunks,
          documentId: mockDocumentId,
        })
      ).rejects.toThrow('There was a problem creating the embeddings');

      expect(mockLogger.error).toHaveBeenCalledWith(
        `There was a problem creating embeddings for document ${mockDocumentId}`,
        expect.any(Error)
      );
    });
  });

  describe('transaction behavior', () => {
    it('should execute all operations within a single transaction with timeout', async () => {
      await createEmbeddings({
        embeddings: mockEmbeddings,
        chunks: mockChunks,
        documentId: mockDocumentId,
      });

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 60000 });
    });

    it('should pass transaction object to executeRaw calls', async () => {
      const mockTx = { $executeRaw: mockExecuteRaw };
      mockTransaction.mockImplementation((callback) => callback(mockTx));

      await createEmbeddings({
        embeddings: mockEmbeddings,
        chunks: mockChunks,
        documentId: mockDocumentId,
      });

      expect(mockExecuteRaw).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe('SQL query construction', () => {
    it('should construct proper INSERT SQL with all required fields', async () => {
      await createEmbeddings({
        embeddings: [mockEmbeddings[0]],
        chunks: [mockChunks[0]],
        documentId: mockDocumentId,
      });

      const calls = (Prisma.sql as jest.Mock).mock.calls;
      const mainCall = calls.find(call => 
        call[0] && call[0][0] && call[0][0].includes('INSERT INTO "Embedding"')
      );
      
      expect(mainCall).toBeDefined();
      expect(mainCall[0][0]).toContain('INSERT INTO "Embedding"');
      expect(mainCall[0][0]).toContain('"id", "embedding", "content", "contentNum", "startPosition", "endPosition", "sectionPath", "pageStart", "pageEnd", "documentId"');
      expect(mainCall[0][0]).toContain('VALUES');
    });

    it('should use correct UUID casting in SQL', async () => {
      await createEmbeddings({
        embeddings: [mockEmbeddings[0]],
        chunks: [mockChunks[0]],
        documentId: mockDocumentId,
      });

      expect(Prisma.sql).toHaveBeenCalledWith(
        expect.arrayContaining(['', '::uuid']),
        expect.any(String)
      );
      
      expect(Prisma.sql).toHaveBeenCalledWith(
        expect.arrayContaining(['', '::vector']),
        '[0.1,0.2,0.3]'
      );
    });
  });
});
