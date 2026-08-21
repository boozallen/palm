import db from '@/server/db';
import logger from '@/server/logger';
import getCollections from './getCollections';

jest.mock('@/server/db', () => ({
  documentCollection: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('getCollections DAL', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gets own + shared collections with document count and owner attribution', async () => {
    const ownerUserId = 'owner-999';
    const mockCollections = [
      {
        id: 'collection-1',
        name: 'Collection A',
        color: '#FF0000',
        userId: mockUserId,
        adminCreated: false,
        createdAt: new Date('2026-06-17'),
        updatedAt: new Date('2026-06-17'),
        _count: { memberships: 5 },
      },
      {
        id: 'collection-2',
        name: 'pursuit1',
        color: '#00FF00',
        userId: ownerUserId,
        adminCreated: true,
        createdAt: new Date('2026-06-16'),
        updatedAt: new Date('2026-06-16'),
        _count: { memberships: 3 },
      },
    ];

    (db.documentCollection.findMany as jest.Mock).mockResolvedValue(
      mockCollections
    );

    const result = await getCollections({ userId: mockUserId });

    expect(result).toEqual([
      {
        id: 'collection-1',
        name: 'Collection A',
        color: '#FF0000',
        userId: mockUserId,
        shared: false,
        createdAt: new Date('2026-06-17'),
        updatedAt: new Date('2026-06-17'),
        documentCount: 5,
      },
      {
        id: 'collection-2',
        name: 'pursuit1',
        color: '#00FF00',
        userId: ownerUserId,
        shared: true,
        createdAt: new Date('2026-06-16'),
        updatedAt: new Date('2026-06-16'),
        documentCount: 3,
      },
    ]);

    // Access-gated where: own collections OR shared collections holding a doc
    // the user can access (their own or an admin-shared doc via accessUsers).
    expect(db.documentCollection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { userId: mockUserId },
            {
              adminCreated: true,
              memberships: {
                some: {
                  document: {
                    OR: [
                      { userId: mockUserId },
                      { adminCreated: true, accessUsers: { some: { id: mockUserId } } },
                    ],
                  },
                },
              },
            },
          ],
        },
        orderBy: { name: 'asc' },
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns empty array when no collections exist', async () => {
    (db.documentCollection.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getCollections({ userId: mockUserId });

    expect(result).toEqual([]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs error and throws when database operation fails', async () => {
    const mockError = new Error('Database error');

    (db.documentCollection.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getCollections({ userId: mockUserId })).rejects.toThrow(
      'Error getting document collections'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error getting document collections',
      mockError
    );
  });
});
