import db from '@/server/db';
import acceptSharedDocument from './acceptSharedDocument';
import { SharedDocumentActionStatus } from '@/features/shared/types/document';
import { getGraphCopyQueue } from '@/features/shared/utils/document-library/worker';
import { storage } from '@/server/storage/redis';
import { getSharedDocumentExpirationDate } from '@/features/shared/utils/dateUtils';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
  graphMetadata: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
}));

jest.mock('@/features/shared/utils/document-library/worker', () => ({
  getGraphCopyQueue: jest.fn(),
}));

jest.mock('@/server/storage/redis', () => ({
  storage: {
    hset: jest.fn(),
  },
}));

jest.mock('@/features/shared/utils/dateUtils', () => ({
  getSharedDocumentExpirationDate: jest.fn(),
}));

describe('acceptSharedDocument', () => {
  const mockUserId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
  const mockSharedDocumentId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockGroupId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const mockSourceDocId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
  const mockCopiedDocId = 'd4e5f6a7-b8c9-0123-def0-234567890123';
  const mockActionId = 'e5f6a7b8-c9d0-1234-ef01-345678901234';
  const mockCreatedAt = new Date();

  const mockSourceDocument = {
    id: mockSourceDocId,
    filename: 'test.pdf',
    uploadStatus: 'Completed',
    documentUploadProviderId: 'f6a7b8c9-d0e1-2345-f012-456789012345',
    text: 'Document content',
    embeddings: [],
    graphEntityEmbeddings: [],
    graphConceptEmbeddings: [],
  };

  const mockSharedDocument = {
    id: mockSharedDocumentId,
    sourceDocumentId: mockSourceDocId,
    sourceUserId: 'other-user-id',
    sharedWithUserGroupIds: [mockGroupId],
    deletedAt: null,
    sourceDocument: mockSourceDocument,
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphCopyQueue as jest.Mock).mockReturnValue(null);

    // Mock expiration date to be 7 days ago (default behavior)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    (getSharedDocumentExpirationDate as jest.Mock).mockReturnValue(sevenDaysAgo);
  });

  it('should accept shared document and create copy', async () => {
    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue(mockSharedDocument),
      },
      sharedDocumentAction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: mockActionId,
          sharedDocumentId: mockSharedDocumentId,
          userId: mockUserId,
          status: SharedDocumentActionStatus.Accepted,
          copiedDocumentId: mockCopiedDocId,
          createdAt: mockCreatedAt,
        }),
      },
      document: {
        create: jest.fn().mockResolvedValue({
          id: mockCopiedDocId,
          userId: mockUserId,
          filename: 'test.pdf',
        }),
      },
      $executeRaw: jest.fn(),
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const result = await callback(mockPrisma);
      return result;
    });

    const result = await acceptSharedDocument({
      sharedDocumentId: mockSharedDocumentId,
      userId: mockUserId,
      userGroupIds: [mockGroupId],
    });

    expect(result).toEqual({
      action: {
        id: mockActionId,
        sharedDocumentId: mockSharedDocumentId,
        copiedDocumentId: mockCopiedDocId,
        userId: mockUserId,
        status: SharedDocumentActionStatus.Accepted,
        createdAt: mockCreatedAt,
      },
      filename: 'test.pdf',
      graphCopyJobId: null,
    });

    expect(mockPrisma.document.create).toHaveBeenCalledWith({
      data: {
        userId: mockUserId,
        filename: 'test.pdf',
        uploadStatus: 'Completed',
        documentUploadProviderId: mockSourceDocument.documentUploadProviderId,
        text: 'Document content',
      },
    });

    expect(mockPrisma.sharedDocumentAction.create).toHaveBeenCalledWith({
      data: {
        sharedDocumentId: mockSharedDocumentId,
        userId: mockUserId,
        status: SharedDocumentActionStatus.Accepted,
        copiedDocumentId: mockCopiedDocId,
      },
    });
  });

  it('should queue graph copy job when source has graph data', async () => {
    const mockSharedDocWithGraphData = {
      ...mockSharedDocument,
      sourceDocument: {
        ...mockSourceDocument,
        graphEntityEmbeddings: [{ id: 'entity-1' }],
      },
    };

    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue(mockSharedDocWithGraphData),
      },
      sharedDocumentAction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: mockActionId,
          sharedDocumentId: mockSharedDocumentId,
          userId: mockUserId,
          status: SharedDocumentActionStatus.Accepted,
          copiedDocumentId: mockCopiedDocId,
          createdAt: mockCreatedAt,
        }),
      },
      document: {
        create: jest.fn().mockResolvedValue({
          id: mockCopiedDocId,
        }),
      },
      $executeRaw: jest.fn(),
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockPrisma);
    });

    (getGraphCopyQueue as jest.Mock).mockReturnValue(mockQueue);

    const result = await acceptSharedDocument({
      sharedDocumentId: mockSharedDocumentId,
      userId: mockUserId,
      userGroupIds: [mockGroupId],
    });

    expect(result.graphCopyJobId).not.toBeNull();
    expect(mockQueue.add).toHaveBeenCalledWith('graph-copy', expect.objectContaining({
      userId: mockUserId,
      sourceDocumentId: mockSourceDocId,
      targetDocumentId: mockCopiedDocId,
      filename: 'test.pdf',
    }));
    expect(storage.hset).toHaveBeenCalled();
  });

  it('should throw error if shared document not found', async () => {
    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockPrisma);
    });

    await expect(
      acceptSharedDocument({
        sharedDocumentId: mockSharedDocumentId,
        userId: mockUserId,
        userGroupIds: [mockGroupId],
      })
    ).rejects.toThrow('Shared document not found');
  });

  it('should throw error if share has been soft deleted', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue({
          ...mockSharedDocument,
          deletedAt: pastDate,
        }),
      },
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockPrisma);
    });

    await expect(
      acceptSharedDocument({
        sharedDocumentId: mockSharedDocumentId,
        userId: mockUserId,
        userGroupIds: [mockGroupId],
      })
    ).rejects.toThrow('This share has expired');
  });

  it('should throw error if share is older than expiration date', async () => {
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    
    // Mock expiration date to be 7 days ago, so document created 8 days ago is expired
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    (getSharedDocumentExpirationDate as jest.Mock).mockReturnValue(sevenDaysAgo);

    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue({
          ...mockSharedDocument,
          createdAt: eightDaysAgo,
          deletedAt: null,
        }),
      },
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockPrisma);
    });

    await expect(
      acceptSharedDocument({
        sharedDocumentId: mockSharedDocumentId,
        userId: mockUserId,
        userGroupIds: [mockGroupId],
      })
    ).rejects.toThrow('This share has expired');
  });

  it('should throw error if user does not have access', async () => {
    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue(mockSharedDocument),
      },
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockPrisma);
    });

    await expect(
      acceptSharedDocument({
        sharedDocumentId: mockSharedDocumentId,
        userId: mockUserId,
        userGroupIds: ['different-group-id'],
      })
    ).rejects.toThrow('You do not have access to this shared document');
  });

  it('should copy embeddings when they exist', async () => {
    const mockSharedDocWithEmbeddings = {
      ...mockSharedDocument,
      sourceDocument: {
        ...mockSourceDocument,
        embeddings: [{ id: 'emb-1' }],
      },
    };

    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue(mockSharedDocWithEmbeddings),
      },
      sharedDocumentAction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: mockActionId,
          sharedDocumentId: mockSharedDocumentId,
          userId: mockUserId,
          status: SharedDocumentActionStatus.Accepted,
          copiedDocumentId: mockCopiedDocId,
          createdAt: mockCreatedAt,
        }),
      },
      document: {
        create: jest.fn().mockResolvedValue({
          id: mockCopiedDocId,
        }),
      },
      $executeRaw: jest.fn(),
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockPrisma);
    });

    await acceptSharedDocument({
      sharedDocumentId: mockSharedDocumentId,
      userId: mockUserId,
      userGroupIds: [mockGroupId],
    });

    // Should have called $executeRaw for embedding copy
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    const embeddingCopySql = mockPrisma.$executeRaw.mock.calls[0][0].join('');
    expect(embeddingCopySql).toContain('"sectionPath", "pageStart", "pageEnd"');
  });

  it('should handle graph copying when enabled', async () => {
    // Create a mock with graph embeddings
    const mockSharedDocWithGraph = {
      ...mockSharedDocument,
      sourceDocument: {
        ...mockSourceDocument,
        graphEntityEmbeddings: [{ id: 'entity-1', entityName: 'Test Entity' }],
        graphConceptEmbeddings: [{ id: 'concept-1', conceptName: 'Test Concept' }],
      },
    };

    // Mock the queue to return a working add method
    (getGraphCopyQueue as jest.Mock).mockReturnValue(mockQueue);
    (storage.hset as jest.Mock).mockResolvedValue(undefined);

    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue(mockSharedDocWithGraph),
      },
      sharedDocumentAction: {
        create: jest.fn().mockResolvedValue({
          id: mockActionId,
          sharedDocumentId: mockSharedDocumentId,
          userId: mockUserId,
          status: SharedDocumentActionStatus.Accepted,
          copiedDocumentId: mockCopiedDocId,
          createdAt: mockCreatedAt,
        }),
      },
      document: {
        create: jest.fn().mockResolvedValue({
          id: mockCopiedDocId,
          userId: mockUserId,
          filename: 'test.pdf',
        }),
      },
      $executeRaw: jest.fn(),
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const result = await callback(mockPrisma);
      return result;
    });

    const result = await acceptSharedDocument({
      sharedDocumentId: mockSharedDocumentId,
      userId: mockUserId,
      userGroupIds: [mockGroupId],
    });

    // Should return a graphCopyJobId when graph data exists
    expect(result.graphCopyJobId).toBeTruthy();

    // Queue should be called to add the job
    expect(mockQueue.add).toHaveBeenCalledWith(
      'graph-copy',
      expect.objectContaining({
        jobId: expect.any(String),
        userId: mockUserId,
        sourceDocumentId: mockSourceDocId,
        targetDocumentId: mockCopiedDocId,
      })
    );

    // Graph metadata should not be created in DAL (happens in worker)
    expect(db.graphMetadata.create).not.toHaveBeenCalled();
  });

  it('should queue graph copy job when source has graph data', async () => {
    // Create a mock with graph embeddings
    const mockSharedDocWithGraph = {
      ...mockSharedDocument,
      sourceDocument: {
        ...mockSourceDocument,
        graphEntityEmbeddings: [{ id: 'entity-1' }],
      },
    };

    // Mock the queue to return a working add method
    (getGraphCopyQueue as jest.Mock).mockReturnValue(mockQueue);
    (storage.hset as jest.Mock).mockResolvedValue(undefined);

    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue(mockSharedDocWithGraph),
      },
      sharedDocumentAction: {
        create: jest.fn().mockResolvedValue({
          id: mockActionId,
          sharedDocumentId: mockSharedDocumentId,
          userId: mockUserId,
          status: SharedDocumentActionStatus.Accepted,
          copiedDocumentId: mockCopiedDocId,
          createdAt: mockCreatedAt,
        }),
      },
      document: {
        create: jest.fn().mockResolvedValue({
          id: mockCopiedDocId,
          userId: mockUserId,
          filename: 'test.pdf',
        }),
      },
      $executeRaw: jest.fn(),
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const result = await callback(mockPrisma);
      return result;
    });

    const result = await acceptSharedDocument({
      sharedDocumentId: mockSharedDocumentId,
      userId: mockUserId,
      userGroupIds: [mockGroupId],
    });

    // Should return a jobId when graph embeddings exist
    expect(result.graphCopyJobId).toBeTruthy();

    // Queue should be called
    expect(mockQueue.add).toHaveBeenCalled();
  });

  it('should return null graphCopyJobId when source has no graph data', async () => {
    // Mock a shared document with no graph embeddings
    const mockSharedDocumentNoGraph = {
      ...mockSharedDocument,
      sourceDocument: {
        ...mockSharedDocument.sourceDocument,
        graphEntityEmbeddings: [],
        graphConceptEmbeddings: [],
      },
    };

    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue(mockSharedDocumentNoGraph),
      },
      sharedDocumentAction: {
        create: jest.fn().mockResolvedValue({
          id: mockActionId,
          sharedDocumentId: mockSharedDocumentId,
          userId: mockUserId,
          status: SharedDocumentActionStatus.Accepted,
          copiedDocumentId: mockCopiedDocId,
          createdAt: mockCreatedAt,
        }),
      },
      document: {
        create: jest.fn().mockResolvedValue({
          id: mockCopiedDocId,
          userId: mockUserId,
          filename: 'test.pdf',
        }),
      },
      $executeRaw: jest.fn(),
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const result = await callback(mockPrisma);
      return result;
    });

    const result = await acceptSharedDocument({
      sharedDocumentId: mockSharedDocumentId,
      userId: mockUserId,
      userGroupIds: [mockGroupId],
    });

    // Should return null when no graph data to copy
    expect(result.graphCopyJobId).toBeNull();
    expect(result.action).toBeDefined();
  });
});
