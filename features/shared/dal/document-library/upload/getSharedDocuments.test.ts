import db from '@/server/db';
import getSharedDocuments from './getSharedDocuments';
import { getSharedDocumentExpirationDate } from '@/features/shared/utils/dateUtils';

jest.mock('@/server/db', () => ({
  sharedDocument: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/features/shared/utils/dateUtils', () => ({
  getSharedDocumentExpirationDate: jest.fn(),
}));

describe('getSharedDocuments', () => {
  const mockUserId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
  const mockGroupId1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockGroupId2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock expiration date to be 7 days ago (default behavior)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    (getSharedDocumentExpirationDate as jest.Mock).mockReturnValue(sevenDaysAgo);
  });

  it('returns empty incoming array if user has no groups, but still queries outgoing', async () => {
    const mockCreatedAt = new Date();
    const mockSharedByMe = [
      {
        id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
        sourceDocumentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
        sharedWithUserGroupIds: [mockGroupId1],
        createdAt: mockCreatedAt,
        sourceDocument: {
          filename: 'my-shared-file.pdf',
        },
      },
    ];

    (db.sharedDocument.findMany as jest.Mock).mockResolvedValue(mockSharedByMe);

    const result = await getSharedDocuments({
      userId: mockUserId,
      userGroupIds: [],
    });

    expect(result.incoming).toEqual([]);
    expect(result.outgoing).toEqual([
      {
        id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
        documentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
        filename: 'my-shared-file.pdf',
        sharedWithUserGroupIds: [mockGroupId1],
        createdAt: mockCreatedAt,
      },
    ]);
    // Only outgoing query should have been called
    expect(db.sharedDocument.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns both incoming and outgoing documents', async () => {
    const mockCreatedAt = new Date();
    const mockSharedWithMe = [
      {
        id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
        sourceDocumentId: 'd4e5f6a7-b8c9-0123-def0-234567890123',
        sourceUserId: 'e5f6a7b8-c9d0-1234-ef01-345678901234',
        sharedWithUserGroupIds: [mockGroupId1],
        createdAt: mockCreatedAt,
        deletedAt: null,
        sourceDocument: {
          filename: 'shared-file.pdf',
        },
        sourceUser: {
          name: 'sharer@example.com',
        },
      },
    ];

    const mockSharedByMe = [
      {
        id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
        sourceDocumentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
        sharedWithUserGroupIds: [mockGroupId1],
        createdAt: mockCreatedAt,
        sourceDocument: {
          filename: 'my-shared-file.pdf',
        },
      },
    ];

    (db.sharedDocument.findMany as jest.Mock)
      .mockResolvedValueOnce(mockSharedWithMe)
      .mockResolvedValueOnce(mockSharedByMe);

    const result = await getSharedDocuments({
      userId: mockUserId,
      userGroupIds: [mockGroupId1, mockGroupId2],
    });

    expect(result.incoming).toEqual([
      {
        id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
        sourceDocumentId: 'd4e5f6a7-b8c9-0123-def0-234567890123',
        sourceUserId: 'e5f6a7b8-c9d0-1234-ef01-345678901234',
        sourceFilename: 'shared-file.pdf',
        sharedByUsername: 'sharer@example.com',
        createdAt: mockCreatedAt,
      },
    ]);

    expect(result.outgoing).toEqual([
      {
        id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
        documentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
        filename: 'my-shared-file.pdf',
        sharedWithUserGroupIds: [mockGroupId1],
        createdAt: mockCreatedAt,
      },
    ]);

    // Both queries should have been called
    expect(db.sharedDocument.findMany).toHaveBeenCalledTimes(2);

    // Verify incoming query (first call)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    expect(db.sharedDocument.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        sharedWithUserGroupIds: {
          hasSome: [mockGroupId1, mockGroupId2],
        },
        deletedAt: null,
        createdAt: {
          gt: expect.any(Date),
        },
        sourceUserId: {
          not: mockUserId,
        },
        actions: {
          none: {
            userId: mockUserId,
          },
        },
      },
      include: {
        sourceDocument: true,
        sourceUser: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Verify outgoing query (second call)
    expect(db.sharedDocument.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        sourceUserId: mockUserId,
        deletedAt: null,
        createdAt: {
          gt: expect.any(Date),
        },
      },
      include: {
        sourceDocument: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('throws error on database failure', async () => {
    (db.sharedDocument.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(
      getSharedDocuments({
        userId: mockUserId,
        userGroupIds: [mockGroupId1],
      })
    ).rejects.toThrow('Error getting shared documents');
  });
});
