import db from '@/server/db';
import logger from '@/server/logger';
import updateCollection from './updateCollection';

jest.mock('@/server/db', () => ({
  documentCollection: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('updateCollection DAL', () => {
  const mockUserId = 'user-123';
  const mockCollectionId = 'collection-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates collection name and color', async () => {
    const mockExisting = {
      id: mockCollectionId,
      name: 'Old Name',
      color: '#FF0000',
      userId: mockUserId,
    };

    const mockUpdated = {
      id: mockCollectionId,
      name: 'New Name',
      color: '#00FF00',
      userId: mockUserId,
      createdAt: new Date('2026-06-17'),
      updatedAt: new Date('2026-06-17'),
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockExisting
    );
    (db.documentCollection.update as jest.Mock).mockResolvedValue(mockUpdated);

    const result = await updateCollection({
      collectionId: mockCollectionId,
      userId: mockUserId,
      name: 'New Name',
      color: '#00FF00',
    });

    expect(result).toEqual(mockUpdated);
    expect(db.documentCollection.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockCollectionId,
        userId: mockUserId,
      },
    });
    expect(db.documentCollection.update).toHaveBeenCalledWith({
      where: {
        id: mockCollectionId,
      },
      data: {
        name: 'New Name',
        color: '#00FF00',
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('updates only name when color not provided', async () => {
    const mockExisting = {
      id: mockCollectionId,
      name: 'Old Name',
      color: '#FF0000',
      userId: mockUserId,
    };

    const mockUpdated = {
      id: mockCollectionId,
      name: 'New Name',
      color: '#FF0000',
      userId: mockUserId,
      createdAt: new Date('2026-06-17'),
      updatedAt: new Date('2026-06-17'),
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockExisting
    );
    (db.documentCollection.update as jest.Mock).mockResolvedValue(mockUpdated);

    const result = await updateCollection({
      collectionId: mockCollectionId,
      userId: mockUserId,
      name: 'New Name',
    });

    expect(result).toEqual(mockUpdated);
    expect(db.documentCollection.update).toHaveBeenCalledWith({
      where: {
        id: mockCollectionId,
      },
      data: {
        name: 'New Name',
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws error when collection not found', async () => {
    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      updateCollection({
        collectionId: mockCollectionId,
        userId: mockUserId,
        name: 'New Name',
      })
    ).rejects.toThrow('Error updating document collection');

    expect(db.documentCollection.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockCollectionId,
        userId: mockUserId,
      },
    });
    expect(db.documentCollection.update).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws error when user does not own collection', async () => {
    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      updateCollection({
        collectionId: mockCollectionId,
        userId: 'different-user',
        name: 'New Name',
      })
    ).rejects.toThrow('Error updating document collection');

    expect(db.documentCollection.update).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('logs error and throws when database operation fails', async () => {
    const mockError = new Error('Database error');
    const mockExisting = {
      id: mockCollectionId,
      name: 'Old Name',
      userId: mockUserId,
    };

    (db.documentCollection.findFirst as jest.Mock).mockResolvedValue(
      mockExisting
    );
    (db.documentCollection.update as jest.Mock).mockRejectedValue(mockError);

    await expect(
      updateCollection({
        collectionId: mockCollectionId,
        userId: mockUserId,
        name: 'New Name',
      })
    ).rejects.toThrow('Error updating document collection');

    expect(logger.error).toHaveBeenCalledWith(
      'Error updating document collection',
      mockError
    );
  });
});
