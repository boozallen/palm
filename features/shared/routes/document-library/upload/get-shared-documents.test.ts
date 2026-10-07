import { ContextType } from '@/server/trpc-context';
import sharedRouter from '@/features/shared/routes';
import getSharedDocuments from '@/features/shared/dal/document-library/upload/getSharedDocuments';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import logger from '@/server/logger';

jest.mock('@/features/shared/dal/document-library/upload/getSharedDocuments');
jest.mock('@/features/profile/dal/getUserGroups');

describe('getSharedDocuments', () => {
  const mockUserId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
  const mockGroupId1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockGroupId2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const mockCreatedAt = new Date();

  const ctx = {
    userId: mockUserId,
    logger,
  } as unknown as ContextType;

  const mockUserGroups = [
    { id: mockGroupId1, label: 'Group 1', role: 'User' },
    { id: mockGroupId2, label: 'Group 2', role: 'User' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return shared documents (both incoming and outgoing)', async () => {
    const mockSharedWithMe = [
      {
        id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
        sourceDocumentId: 'd4e5f6a7-b8c9-0123-def0-234567890123',
        sourceUserId: 'e5f6a7b8-c9d0-1234-ef01-345678901234',
        sourceFilename: 'shared-file.pdf',
        sharedByUsername: 'sharer@example.com',
        createdAt: mockCreatedAt,
      },
    ];

    const mockSharedByMe = [
      {
        id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
        documentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
        filename: 'my-shared-file.pdf',
        sharedWithUserGroupIds: [mockGroupId1],
        createdAt: mockCreatedAt,
      },
    ];

    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (getSharedDocuments as jest.Mock).mockResolvedValue({
      incoming: mockSharedWithMe,
      outgoing: mockSharedByMe,
    });

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.getSharedDocuments();

    expect(result.incoming).toEqual(mockSharedWithMe);
    expect(result.outgoing).toEqual(mockSharedByMe);

    expect(getUserGroups).toHaveBeenCalledWith(mockUserId);
    expect(getSharedDocuments).toHaveBeenCalledWith({
      userId: mockUserId,
      userGroupIds: [mockGroupId1, mockGroupId2],
    });
  });

  it('should return empty arrays when user has no groups and no shares', async () => {
    (getUserGroups as jest.Mock).mockResolvedValue([]);
    (getSharedDocuments as jest.Mock).mockResolvedValue({
      incoming: [],
      outgoing: [],
    });

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.getSharedDocuments();

    expect(result.incoming).toEqual([]);
    expect(result.outgoing).toEqual([]);

    expect(getUserGroups).toHaveBeenCalledWith(mockUserId);
    expect(getSharedDocuments).toHaveBeenCalledWith({
      userId: mockUserId,
      userGroupIds: [],
    });
  });

  it('should throw error on DAL failure', async () => {
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (getSharedDocuments as jest.Mock).mockRejectedValue(
      new Error('Error getting shared documents')
    );

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getSharedDocuments()).rejects.toThrow(
      'Error getting shared documents'
    );
  });
});
