import db from '@/server/db';
import logger from '@/server/logger';
import createCollection from './createCollection';

jest.mock('@/server/db', () => ({
  documentCollection: {
    create: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('createCollection DAL', () => {
  const mockUserId = 'user-123';
  const mockCollectionName = 'My Collection';
  const mockColor = '#FF0000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a collection with custom color', async () => {
    const mockCreatedCollection = {
      id: 'collection-123',
      name: mockCollectionName,
      color: mockColor,
      userId: mockUserId,
      createdAt: new Date('2026-06-17'),
      updatedAt: new Date('2026-06-17'),
    };

    (db.documentCollection.create as jest.Mock).mockResolvedValue(
      mockCreatedCollection
    );

    const result = await createCollection({
      name: mockCollectionName,
      color: mockColor,
      userId: mockUserId,
    });

    expect(result).toEqual(mockCreatedCollection);
    expect(db.documentCollection.create).toHaveBeenCalledWith({
      data: {
        name: mockCollectionName,
        color: mockColor,
        userId: mockUserId,
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('creates a collection with default color when not provided', async () => {
    const mockCreatedCollection = {
      id: 'collection-123',
      name: mockCollectionName,
      color: '#228BE6',
      userId: mockUserId,
      createdAt: new Date('2026-06-17'),
      updatedAt: new Date('2026-06-17'),
    };

    (db.documentCollection.create as jest.Mock).mockResolvedValue(
      mockCreatedCollection
    );

    const result = await createCollection({
      name: mockCollectionName,
      userId: mockUserId,
    });

    expect(result).toEqual(mockCreatedCollection);
    expect(db.documentCollection.create).toHaveBeenCalledWith({
      data: {
        name: mockCollectionName,
        color: '#228BE6',
        userId: mockUserId,
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs error and throws when database operation fails', async () => {
    const mockError = new Error('Database error');

    (db.documentCollection.create as jest.Mock).mockRejectedValue(mockError);

    await expect(
      createCollection({
        name: mockCollectionName,
        color: mockColor,
        userId: mockUserId,
      })
    ).rejects.toThrow('Error creating document collection');

    expect(logger.error).toHaveBeenCalledWith(
      'Error creating document collection',
      mockError
    );
  });
});
