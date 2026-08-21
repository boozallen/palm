import db from '@/server/db';
import logger from '@/server/logger';
import deleteCollection from './deleteCollection';

jest.mock('@/server/db', () => ({
  documentCollection: {
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('deleteCollection DAL', () => {
  const mockUserId = 'user-123';
  const mockCollectionId = 'collection-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes collection successfully', async () => {
    const mockExisting = {
      id: mockCollectionId,
      name: 'Collection',
      userId: mockUserId,
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockExisting
    );
    (db.documentCollection.delete as jest.Mock).mockResolvedValue({});

    const result = await deleteCollection({
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
    expect(db.documentCollection.delete).toHaveBeenCalledWith({
      where: {
        id: mockCollectionId,
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws error when collection not found', async () => {
    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      deleteCollection({
        collectionId: mockCollectionId,
        userId: mockUserId,
      })
    ).rejects.toThrow('Error deleting document collection');

    expect(db.documentCollection.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockCollectionId,
        userId: mockUserId,
      },
    });
    expect(db.documentCollection.delete).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws error when user does not own collection', async () => {
    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      deleteCollection({
        collectionId: mockCollectionId,
        userId: 'different-user',
      })
    ).rejects.toThrow('Error deleting document collection');

    expect(db.documentCollection.delete).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('logs error and throws when database operation fails', async () => {
    const mockError = new Error('Database error');
    const mockExisting = {
      id: mockCollectionId,
      name: 'Collection',
      userId: mockUserId,
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockExisting
    );
    (db.documentCollection.delete as jest.Mock).mockRejectedValue(mockError);

    await expect(
      deleteCollection({
        collectionId: mockCollectionId,
        userId: mockUserId,
      })
    ).rejects.toThrow('Error deleting document collection');

    expect(logger.error).toHaveBeenCalledWith(
      'Error deleting document collection',
      mockError
    );
  });
});
