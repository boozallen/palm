import db from '@/server/db';
import logger from '@/server/logger';
import getDocumentCollections from './getDocumentCollections';

jest.mock('@/server/db', () => ({
  document: {
    findFirst: jest.fn(),
  },
  documentCollectionMembership: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('getDocumentCollections DAL', () => {
  const mockUserId = 'user-123';
  const mockDocumentId = 'document-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gets collections for user-owned document', async () => {
    const mockDocument = {
      id: mockDocumentId,
      userId: mockUserId,
    };

    const mockMemberships = [
      {
        documentId: mockDocumentId,
        collectionId: 'collection-1',
        collection: {
          id: 'collection-1',
          name: 'Collection A',
          color: '#FF0000',
          userId: mockUserId,
          createdAt: new Date('2026-06-17'),
          updatedAt: new Date('2026-06-17'),
        },
      },
      {
        documentId: mockDocumentId,
        collectionId: 'collection-2',
        collection: {
          id: 'collection-2',
          name: 'Collection B',
          color: '#00FF00',
          userId: mockUserId,
          createdAt: new Date('2026-06-16'),
          updatedAt: new Date('2026-06-16'),
        },
      },
    ];

    (db.document.findFirst as jest.Mock).mockResolvedValue(mockDocument);
    (db.documentCollectionMembership.findMany as jest.Mock).mockResolvedValue(
      mockMemberships
    );

    const result = await getDocumentCollections({
      documentId: mockDocumentId,
      userId: mockUserId,
    });

    expect(result).toEqual([
      mockMemberships[0].collection,
      mockMemberships[1].collection,
    ]);
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
    expect(db.documentCollectionMembership.findMany).toHaveBeenCalledWith({
      where: {
        documentId: mockDocumentId,
      },
      include: {
        collection: true,
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('gets collections for admin-created document with user access', async () => {
    const mockDocument = {
      id: mockDocumentId,
      adminCreated: true,
      accessUsers: [{ id: mockUserId }],
    };

    const mockMemberships = [
      {
        documentId: mockDocumentId,
        collectionId: 'collection-1',
        collection: {
          id: 'collection-1',
          name: 'Collection A',
          color: '#FF0000',
          userId: mockUserId,
          createdAt: new Date('2026-06-17'),
          updatedAt: new Date('2026-06-17'),
        },
      },
    ];

    (db.document.findFirst as jest.Mock).mockResolvedValue(mockDocument);
    (db.documentCollectionMembership.findMany as jest.Mock).mockResolvedValue(
      mockMemberships
    );

    const result = await getDocumentCollections({
      documentId: mockDocumentId,
      userId: mockUserId,
    });

    expect(result).toEqual([mockMemberships[0].collection]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns empty array when document has no collections', async () => {
    const mockDocument = {
      id: mockDocumentId,
      userId: mockUserId,
    };

    (db.document.findFirst as jest.Mock).mockResolvedValue(mockDocument);
    (db.documentCollectionMembership.findMany as jest.Mock).mockResolvedValue(
      []
    );

    const result = await getDocumentCollections({
      documentId: mockDocumentId,
      userId: mockUserId,
    });

    expect(result).toEqual([]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws error when document not found', async () => {
    (db.document.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      getDocumentCollections({
        documentId: mockDocumentId,
        userId: mockUserId,
      })
    ).rejects.toThrow('Error getting document collections');

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
    expect(db.documentCollectionMembership.findMany).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws error when user does not have access to document', async () => {
    (db.document.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      getDocumentCollections({
        documentId: mockDocumentId,
        userId: 'different-user',
      })
    ).rejects.toThrow('Error getting document collections');

    expect(db.documentCollectionMembership.findMany).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('logs error and throws when database operation fails', async () => {
    const mockError = new Error('Database error');
    const mockDocument = {
      id: mockDocumentId,
      userId: mockUserId,
    };

    (db.document.findFirst as jest.Mock).mockResolvedValue(mockDocument);
    (db.documentCollectionMembership.findMany as jest.Mock).mockRejectedValue(
      mockError
    );

    await expect(
      getDocumentCollections({
        documentId: mockDocumentId,
        userId: mockUserId,
      })
    ).rejects.toThrow('Error getting document collections');

    expect(logger.error).toHaveBeenCalledWith(
      'Error getting document collections',
      mockError
    );
  });
});
