import db from '@/server/db';
import rejectSharedDocument from './rejectSharedDocument';
import { SharedDocumentActionStatus } from '@/features/shared/types/document';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

describe('rejectSharedDocument', () => {
  const mockUserId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
  const mockSharedDocumentId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockGroupId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const mockActionId = 'd4e5f6a7-b8c9-0123-def0-234567890123';
  const mockCreatedAt = new Date();

  const mockSharedDocument = {
    id: mockSharedDocumentId,
    sourceDocumentId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    sourceUserId: 'other-user-id',
    sharedWithUserGroupIds: [mockGroupId],
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject shared document successfully', async () => {
    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue(mockSharedDocument),
      },
      sharedDocumentAction: {
        create: jest.fn().mockResolvedValue({
          id: mockActionId,
          sharedDocumentId: mockSharedDocumentId,
          userId: mockUserId,
          status: SharedDocumentActionStatus.Rejected,
          copiedDocumentId: null,
          createdAt: mockCreatedAt,
        }),
      },
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const result = await callback(mockPrisma);
      return result;
    });

    const result = await rejectSharedDocument({
      sharedDocumentId: mockSharedDocumentId,
      userId: mockUserId,
      userGroupIds: [mockGroupId],
    });

    expect(result).toEqual({
      action: {
        id: mockActionId,
        sharedDocumentId: mockSharedDocumentId,
        copiedDocumentId: undefined,
        userId: mockUserId,
        status: SharedDocumentActionStatus.Rejected,
        createdAt: mockCreatedAt,
      },
    });

    expect(mockPrisma.sharedDocument.findUnique).toHaveBeenCalledWith({
      where: { id: mockSharedDocumentId },
    });

    expect(mockPrisma.sharedDocumentAction.create).toHaveBeenCalledWith({
      data: {
        sharedDocumentId: mockSharedDocumentId,
        userId: mockUserId,
        status: SharedDocumentActionStatus.Rejected,
      },
    });
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
      rejectSharedDocument({
        sharedDocumentId: mockSharedDocumentId,
        userId: mockUserId,
        userGroupIds: [mockGroupId],
      })
    ).rejects.toThrow('Shared document not found');
  });

  it('should throw error if share has expired', async () => {
    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue({
          ...mockSharedDocument,
          deletedAt: new Date(),
        }),
      },
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockPrisma);
    });

    await expect(
      rejectSharedDocument({
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
      rejectSharedDocument({
        sharedDocumentId: mockSharedDocumentId,
        userId: mockUserId,
        userGroupIds: ['different-group-id'],
      })
    ).rejects.toThrow('You do not have access to this shared document');
  });

  it('should handle user with multiple matching groups', async () => {
    const additionalGroupId = 'f7e8d9c0-b1a2-3456-789a-bcdef0123456';
    const sharedDocWithMultipleGroups = {
      ...mockSharedDocument,
      sharedWithUserGroupIds: [mockGroupId, additionalGroupId],
    };

    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue(sharedDocWithMultipleGroups),
      },
      sharedDocumentAction: {
        create: jest.fn().mockResolvedValue({
          id: mockActionId,
          sharedDocumentId: mockSharedDocumentId,
          userId: mockUserId,
          status: SharedDocumentActionStatus.Rejected,
          copiedDocumentId: null,
          createdAt: mockCreatedAt,
        }),
      },
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const result = await callback(mockPrisma);
      return result;
    });

    const result = await rejectSharedDocument({
      sharedDocumentId: mockSharedDocumentId,
      userId: mockUserId,
      userGroupIds: [mockGroupId, additionalGroupId, 'unrelated-group-id'],
    });

    expect(result).toBeDefined();
    expect(mockPrisma.sharedDocumentAction.create).toHaveBeenCalled();
  });

  it('should handle empty user group array for shared document', async () => {
    const sharedDocWithNoGroups = {
      ...mockSharedDocument,
      sharedWithUserGroupIds: [],
    };

    const mockPrisma = {
      sharedDocument: {
        findUnique: jest.fn().mockResolvedValue(sharedDocWithNoGroups),
      },
    };

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockPrisma);
    });

    await expect(
      rejectSharedDocument({
        sharedDocumentId: mockSharedDocumentId,
        userId: mockUserId,
        userGroupIds: [mockGroupId],
      })
    ).rejects.toThrow('You do not have access to this shared document');
  });
});