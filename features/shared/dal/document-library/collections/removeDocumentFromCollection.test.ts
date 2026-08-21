import db from '@/server/db';
import logger from '@/server/logger';
import removeDocumentFromCollection from './removeDocumentFromCollection';

jest.mock('@/server/db', () => ({
  documentCollection: {
    findFirst: jest.fn(),
  },
  documentCollectionMembership: {
    delete: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('removeDocumentFromCollection DAL', () => {
  const mockUserId = 'user-123';
  const mockCollectionId = 'collection-123';
  const mockDocumentId = 'document-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes document from collection successfully', async () => {
    const mockCollection = {
      id: mockCollectionId,
      userId: mockUserId,
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockCollection
    );
    (db.documentCollectionMembership.delete as jest.Mock).mockResolvedValue({});

    const result = await removeDocumentFromCollection({
      documentId: mockDocumentId,
      collectionId: mockCollectionId,
      userId: mockUserId,
    });

    expect(result).toEqual({ success: true });
    expect(db.documentCollection.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockCollectionId,
        userId: mockUserId,
      },
    });
    expect(db.documentCollectionMembership.delete).toHaveBeenCalledWith({
      where: {
        documentId_collectionId: {
          documentId: mockDocumentId,
          collectionId: mockCollectionId,
        },
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws error when collection not found', async () => {
    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      removeDocumentFromCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
        userId: mockUserId,
      })
    ).rejects.toThrow('Error removing document from collection');

    expect(db.documentCollection.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockCollectionId,
        userId: mockUserId,
      },
    });
    expect(db.documentCollectionMembership.delete).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws error when user does not own collection', async () => {
    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      removeDocumentFromCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
        userId: 'different-user',
      })
    ).rejects.toThrow('Error removing document from collection');

    expect(db.documentCollectionMembership.delete).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('logs error and throws when database operation fails', async () => {
    const mockError = new Error('Database error');
    const mockCollection = {
      id: mockCollectionId,
      userId: mockUserId,
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockCollection
    );
    (db.documentCollectionMembership.delete as jest.Mock).mockRejectedValue(
      mockError
    );

    await expect(
      removeDocumentFromCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
        userId: mockUserId,
      })
    ).rejects.toThrow('Error removing document from collection');

    expect(logger.error).toHaveBeenCalledWith(
      'Error removing document from collection',
      mockError
    );
  });
});
