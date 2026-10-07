import { ContextType } from '@/server/trpc-context';
import sharedRouter from '@/features/shared/routes';
import getDocument from '@/features/shared/dal/document-library/upload/getDocument';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import createSharedDocument from '@/features/shared/dal/document-library/upload/createSharedDocument';
import softDeleteSharedDocument from '@/features/shared/dal/document-library/upload/softDeleteSharedDocument';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import { Forbidden, NotFound, BadRequest } from '@/features/shared/errors/routeErrors';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import logger from '@/server/logger';
import db from '@/server/db';

jest.mock('@/features/shared/dal/document-library/upload/getDocument');
jest.mock('@/features/profile/dal/getUserGroups');
jest.mock('@/features/shared/dal/document-library/upload/createSharedDocument');
jest.mock('@/features/shared/dal/document-library/upload/softDeleteSharedDocument');
jest.mock('@/features/shared/dal/getSystemConfig');
jest.mock('@/server/db', () => ({
  sharedDocument: {
    findFirst: jest.fn(),
  },
  sharedDocumentAction: {
    createMany: jest.fn(),
  },
}));

describe('updateDocumentShares', () => {
  const mockUserId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
  const mockDocumentId = 'd72f155f-7b9a-4ff5-9f08-7c7f0c02f93e';
  const mockCreatedAt = new Date();

  const mockAuditor = {
    createAuditRecord: jest.fn(),
  };

  const ctx = {
    userId: mockUserId,
    logger,
    auditor: mockAuditor,
  } as unknown as ContextType;

  const mockDocument = {
    id: mockDocumentId,
    userId: mockUserId,
    filename: 'test.pdf',
  };

  const mockGroupId1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockGroupId2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const mockSharedDocId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

  const mockUserGroups = [
    { id: mockGroupId1, label: 'Group 1', role: 'User' },
    { id: mockGroupId2, label: 'Group 2', role: 'User' },
  ];

  const mockSharedDocument = {
    id: mockSharedDocId,
    sourceDocumentId: mockDocumentId,
    sourceUserId: mockUserId,
    sharedWithUserGroupIds: [mockGroupId1, mockGroupId2],
    createdAt: mockCreatedAt,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDataSharingEnabled: true,
    });
    (db.sharedDocument.findFirst as jest.Mock).mockResolvedValue(null);
    (db.sharedDocumentAction.createMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  it('should update document shares successfully', async () => {
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (softDeleteSharedDocument as jest.Mock).mockResolvedValue(undefined);
    (createSharedDocument as jest.Mock).mockResolvedValue(mockSharedDocument);

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.updateDocumentShares({
      documentId: mockDocumentId,
      userGroupIds: [mockGroupId1, mockGroupId2],
    });

    expect(result.sharedDocument).toEqual(mockSharedDocument);

    expect(getDocument).toHaveBeenCalledWith(mockDocumentId);
    expect(getUserGroups).toHaveBeenCalledWith(mockUserId);
    expect(softDeleteSharedDocument).toHaveBeenCalledWith({
      sourceDocumentId: mockDocumentId,
      sourceUserId: mockUserId,
    });
    expect(createSharedDocument).toHaveBeenCalledWith({
      sourceDocumentId: mockDocumentId,
      sourceUserId: mockUserId,
      sharedWithUserGroupIds: [mockGroupId1, mockGroupId2],
    });
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: expect.stringContaining('updated shares'),
      event: AuditRecordEvent.ReshareDocumentLibraryData,
    });
  });

  it('should allow unsharing by providing an empty user groups array', async () => {
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (softDeleteSharedDocument as jest.Mock).mockResolvedValue(undefined);
    (createSharedDocument as jest.Mock).mockResolvedValue({
      ...mockSharedDocument,
      sharedWithUserGroupIds: [],
    });

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.updateDocumentShares({
      documentId: mockDocumentId,
      userGroupIds: [],
    });

    expect(result.sharedDocument.sharedWithUserGroupIds).toEqual([]);
    expect(softDeleteSharedDocument).toHaveBeenCalled();
    expect(createSharedDocument).toHaveBeenCalledWith({
      sourceDocumentId: mockDocumentId,
      sourceUserId: mockUserId,
      sharedWithUserGroupIds: [],
    });
  });

  it('should throw BadRequest when no user groups parameter is provided', async () => {
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);

    const caller = sharedRouter.createCaller(ctx);
    await expect(
      caller.updateDocumentShares({ documentId: mockDocumentId }),
    ).rejects.toThrow(
      BadRequest('You must explicitly specify which user groups to share with (or provide an empty array to unshare)'),
    );

    expect(softDeleteSharedDocument).not.toHaveBeenCalled();
    expect(createSharedDocument).not.toHaveBeenCalled();
  });

  it('should throw NotFound if document does not exist', async () => {
    (getDocument as jest.Mock).mockResolvedValue(null);

    const caller = sharedRouter.createCaller(ctx);
    await expect(
      caller.updateDocumentShares({
        documentId: mockDocumentId,
        userGroupIds: [mockGroupId1],
      }),
    ).rejects.toThrow(NotFound('Document not found'));

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('non-existent'),
      event: AuditRecordEvent.ReshareDocumentLibraryData,
    });
  });

  it('should throw Forbidden if user does not own the document', async () => {
    const otherUserDocument = { ...mockDocument, userId: 'other-user-id' };
    (getDocument as jest.Mock).mockResolvedValue(otherUserDocument);

    const caller = sharedRouter.createCaller(ctx);
    await expect(
      caller.updateDocumentShares({
        documentId: mockDocumentId,
        userGroupIds: [mockGroupId1],
      }),
    ).rejects.toThrow(Forbidden('You do not have permission to update shares for this document'));

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('owned by'),
      event: AuditRecordEvent.ReshareDocumentLibraryData,
    });
  });

  it('should throw BadRequest if user is not in any user groups', async () => {
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getUserGroups as jest.Mock).mockResolvedValue([]);

    const caller = sharedRouter.createCaller(ctx);
    await expect(
      caller.updateDocumentShares({
        documentId: mockDocumentId,
        userGroupIds: [mockGroupId1],
      }),
    ).rejects.toThrow(BadRequest('You must be a member of at least one user group to update document shares'));

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('not a member of any user groups'),
      event: AuditRecordEvent.ReshareDocumentLibraryData,
    });
  });

  it('should throw BadRequest if user tries to share with groups they are not a member of', async () => {
    const invalidGroupId = 'c3d4e5f6-a7b8-9012-cdef-999999999999';
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);

    const caller = sharedRouter.createCaller(ctx);
    await expect(
      caller.updateDocumentShares({
        documentId: mockDocumentId,
        userGroupIds: [mockGroupId1, invalidGroupId],
      }),
    ).rejects.toThrow(BadRequest('You can only share with user groups you are a member of'));

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('groups they are not a member of'),
      event: AuditRecordEvent.ReshareDocumentLibraryData,
    });
  });

  it('should throw Forbidden if document sharing is disabled', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDataSharingEnabled: false,
    });

    const caller = sharedRouter.createCaller(ctx);
    await expect(
      caller.updateDocumentShares({
        documentId: mockDocumentId,
        userGroupIds: [mockGroupId1],
      }),
    ).rejects.toThrow(Forbidden('Document sharing is not enabled'));

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('data sharing is disabled'),
      event: AuditRecordEvent.ReshareDocumentLibraryData,
    });

    expect(getDocument).not.toHaveBeenCalled();
  });

  it('should preserve accepted actions when refreshing shares', async () => {
    const mockAcceptedUserId = 'd4e5f6a7-b8c9-0123-def4-567890123456';
    const mockCopiedDocumentId = 'e5f6a7b8-c9d0-1234-ef56-78901234567';
    const existingSharedDocumentWithActions = {
      id: 'f6a7b8c9-d0e1-2345-f678-901234567890',
      sourceDocumentId: mockDocumentId,
      sourceUserId: mockUserId,
      sharedWithUserGroupIds: [mockGroupId1],
      actions: [
        {
          id: 'a7b8c9d0-e1f2-3456-789a-bcdef0123456',
          sharedDocumentId: 'f6a7b8c9-d0e1-2345-f678-901234567890',
          userId: mockAcceptedUserId,
          status: 'accepted',
          copiedDocumentId: mockCopiedDocumentId,
        },
      ],
    };

    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (db.sharedDocument.findFirst as jest.Mock).mockResolvedValue(existingSharedDocumentWithActions);
    (softDeleteSharedDocument as jest.Mock).mockResolvedValue(undefined);
    (createSharedDocument as jest.Mock).mockResolvedValue(mockSharedDocument);

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.updateDocumentShares({
      documentId: mockDocumentId,
      userGroupIds: [mockGroupId1],
    });

    expect(result.sharedDocument).toEqual(mockSharedDocument);
    expect(db.sharedDocument.findFirst).toHaveBeenCalledWith({
      where: {
        sourceDocumentId: mockDocumentId,
        sourceUserId: mockUserId,
        deletedAt: null,
      },
      include: {
        actions: {
          where: {
            status: 'accepted',
          },
        },
      },
    });
    expect(db.sharedDocumentAction.createMany).toHaveBeenCalledWith({
      data: [
        {
          sharedDocumentId: mockSharedDocument.id,
          userId: mockAcceptedUserId,
          status: 'accepted',
          copiedDocumentId: mockCopiedDocumentId,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('should not preserve accepted actions when there are none', async () => {
    const existingSharedDocumentWithoutActions = {
      id: 'f6a7b8c9-d0e1-2345-f678-901234567890',
      sourceDocumentId: mockDocumentId,
      sourceUserId: mockUserId,
      sharedWithUserGroupIds: [mockGroupId1],
      actions: [],
    };

    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (db.sharedDocument.findFirst as jest.Mock).mockResolvedValue(existingSharedDocumentWithoutActions);
    (softDeleteSharedDocument as jest.Mock).mockResolvedValue(undefined);
    (createSharedDocument as jest.Mock).mockResolvedValue(mockSharedDocument);

    const caller = sharedRouter.createCaller(ctx);
    await caller.updateDocumentShares({
      documentId: mockDocumentId,
      userGroupIds: [mockGroupId1],
    });

    expect(db.sharedDocumentAction.createMany).not.toHaveBeenCalled();
  });
});
