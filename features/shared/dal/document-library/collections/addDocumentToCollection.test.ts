import db from '@/server/db';
import logger from '@/server/logger';
import addDocumentToCollection from './addDocumentToCollection';

jest.mock('@/server/db', () => ({
  documentCollection: {
    findFirst: jest.fn(),
  },
  document: {
    findFirst: jest.fn(),
  },
  documentCollectionMembership: {
    upsert: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('addDocumentToCollection DAL', () => {
  const mockUserId = 'user-123';
  const mockCollectionId = 'collection-123';
  const mockDocumentId = 'document-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds user-owned document to collection', async () => {
    const mockCollection = {
      id: mockCollectionId,
      userId: mockUserId,
    };

    const mockDocument = {
      id: mockDocumentId,
      userId: mockUserId,
    };

    const mockMembership = {
      documentId: mockDocumentId,
      collectionId: mockCollectionId,
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockCollection
    );
    (db.document.findFirst as jest.Mock).mockResolvedValue(mockDocument);
    (db.documentCollectionMembership.upsert as jest.Mock).mockResolvedValue(
      mockMembership
    );

    const result = await addDocumentToCollection({
      documentId: mockDocumentId,
      collectionId: mockCollectionId,
      userId: mockUserId,
    });

    expect(result).toEqual(mockMembership);
    expect(db.documentCollection.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockCollectionId,
        userId: mockUserId,
      },
    });
    expect(db.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockDocumentId,
        OR: [
          { userId: mockUserId },
          {
            adminCreated: true,
            accessUsers: { some: { id: mockUserId } },
          },
        ],
      },
    });
    expect(db.documentCollectionMembership.upsert).toHaveBeenCalledWith({
      where: {
        documentId_collectionId: {
          documentId: mockDocumentId,
          collectionId: mockCollectionId,
        },
      },
      create: {
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
      },
      update: {},
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('adds admin-created document with user access to collection', async () => {
    const mockCollection = {
      id: mockCollectionId,
      userId: mockUserId,
    };

    const mockDocument = {
      id: mockDocumentId,
      adminCreated: true,
      accessUsers: [{ id: mockUserId }],
    };

    const mockMembership = {
      documentId: mockDocumentId,
      collectionId: mockCollectionId,
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockCollection
    );
    (db.document.findFirst as jest.Mock).mockResolvedValue(mockDocument);
    (db.documentCollectionMembership.upsert as jest.Mock).mockResolvedValue(
      mockMembership
    );

    const result = await addDocumentToCollection({
      documentId: mockDocumentId,
      collectionId: mockCollectionId,
      userId: mockUserId,
    });

    expect(result).toEqual(mockMembership);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws error when collection not found', async () => {
    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      addDocumentToCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
        userId: mockUserId,
      })
    ).rejects.toThrow('Error adding document to collection');

    expect(db.documentCollection.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockCollectionId,
        userId: mockUserId,
      },
    });
    expect(db.document.findFirst).not.toHaveBeenCalled();
    expect(db.documentCollectionMembership.upsert).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws error when user does not own collection', async () => {
    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      addDocumentToCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
        userId: 'different-user',
      })
    ).rejects.toThrow('Error adding document to collection');

    expect(db.document.findFirst).not.toHaveBeenCalled();
    expect(db.documentCollectionMembership.upsert).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws error when document not found', async () => {
    const mockCollection = {
      id: mockCollectionId,
      userId: mockUserId,
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockCollection
    );
    (db.document.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      addDocumentToCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
        userId: mockUserId,
      })
    ).rejects.toThrow('Error adding document to collection');

    expect(db.documentCollectionMembership.upsert).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws error when user does not have access to document', async () => {
    const mockCollection = {
      id: mockCollectionId,
      userId: mockUserId,
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockCollection
    );
    (db.document.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      addDocumentToCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
        userId: mockUserId,
      })
    ).rejects.toThrow('Error adding document to collection');

    expect(db.documentCollectionMembership.upsert).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('logs error and throws when database operation fails', async () => {
    const mockError = new Error('Database error');
    const mockCollection = {
      id: mockCollectionId,
      userId: mockUserId,
    };
    const mockDocument = {
      id: mockDocumentId,
      userId: mockUserId,
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockCollection
    );
    (db.document.findFirst as jest.Mock).mockResolvedValue(mockDocument);
    (db.documentCollectionMembership.upsert as jest.Mock).mockRejectedValue(
      mockError
    );

    await expect(
      addDocumentToCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
        userId: mockUserId,
      })
    ).rejects.toThrow('Error adding document to collection');

    expect(logger.error).toHaveBeenCalledWith(
      'Error adding document to collection',
      mockError
    );
  });
});
