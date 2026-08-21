import { ContextType } from '@/server/trpc-context';
import sharedRouter from '@/features/shared/routes';
import getDocument from '@/features/shared/dal/document-library/upload/getDocument';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import createSharedDocument from '@/features/shared/dal/document-library/upload/createSharedDocument';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import { Forbidden, NotFound, BadRequest } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

jest.mock('@/features/shared/dal/document-library/upload/getDocument');
jest.mock('@/features/profile/dal/getUserGroups');
jest.mock('@/features/shared/dal/document-library/upload/createSharedDocument');
jest.mock('@/features/shared/dal/getSystemConfig');

describe('shareDocument', () => {
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
    // Default mock for system config - data sharing enabled
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDataSharingEnabled: true,
    });
  });

  it('should share document successfully', async () => {
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (createSharedDocument as jest.Mock).mockResolvedValue(mockSharedDocument);

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.shareDocument({
      documentId: mockDocumentId,
      userGroupIds: [mockGroupId1, mockGroupId2],
    });

    expect(result.sharedDocument).toEqual(mockSharedDocument);

    expect(getDocument).toHaveBeenCalledWith(mockDocumentId);
    expect(getUserGroups).toHaveBeenCalledWith(mockUserId);
    expect(createSharedDocument).toHaveBeenCalledWith({
      sourceDocumentId: mockDocumentId,
      sourceUserId: mockUserId,
      sharedWithUserGroupIds: [mockGroupId1, mockGroupId2],
    });
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: expect.stringContaining('shared document'),
      event: AuditRecordEvent.ShareDocumentLibraryData,
    });
  });

  it('should throw NotFound if document does not exist', async () => {
    (getDocument as jest.Mock).mockResolvedValue(null);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.shareDocument({
      documentId: mockDocumentId,
      userGroupIds: [mockGroupId1],
    })).rejects.toThrow(
      NotFound('Document not found')
    );

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('non-existent'),
      event: AuditRecordEvent.ShareDocumentLibraryData,
    });
  });

  it('should throw Forbidden if user does not own the document', async () => {
    const otherUserDocument = { ...mockDocument, userId: 'other-user-id' };
    (getDocument as jest.Mock).mockResolvedValue(otherUserDocument);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.shareDocument({
      documentId: mockDocumentId,
      userGroupIds: [mockGroupId1],
    })).rejects.toThrow(
      Forbidden('You do not have permission to share this document')
    );

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('owned by'),
      event: AuditRecordEvent.ShareDocumentLibraryData,
    });
  });

  it('should throw BadRequest if user is not in any user groups', async () => {
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getUserGroups as jest.Mock).mockResolvedValue([]);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.shareDocument({
      documentId: mockDocumentId,
      userGroupIds: [mockGroupId1],
    })).rejects.toThrow(
      BadRequest('You must be a member of at least one user group to share a document')
    );

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('not a member of any user groups'),
      event: AuditRecordEvent.ShareDocumentLibraryData,
    });
  });

  it('should throw Forbidden if document sharing is disabled', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDataSharingEnabled: false,
    });

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.shareDocument({
      documentId: mockDocumentId,
      userGroupIds: [mockGroupId1],
    })).rejects.toThrow(
      Forbidden('Document sharing is not enabled')
    );

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('data sharing is disabled'),
      event: AuditRecordEvent.ShareDocumentLibraryData,
    });

    // Should not attempt to get the document if sharing is disabled
    expect(getDocument).not.toHaveBeenCalled();
  });

  it('should throw Forbidden if system config is null', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue(null);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.shareDocument({
      documentId: mockDocumentId,
      userGroupIds: [mockGroupId1],
    })).rejects.toThrow(
      Forbidden('Document sharing is not enabled')
    );

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('data sharing is disabled'),
      event: AuditRecordEvent.ShareDocumentLibraryData,
    });

    // Should not attempt to get the document if sharing is disabled
    expect(getDocument).not.toHaveBeenCalled();
  });

  it('should throw BadRequest if no user groups are selected', async () => {
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.shareDocument({
      documentId: mockDocumentId,
      userGroupIds: [],
    })).rejects.toThrow(
      BadRequest('You must select at least one user group to share with')
    );

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('without selecting any user groups'),
      event: AuditRecordEvent.ShareDocumentLibraryData,
    });
  });

  it('should throw BadRequest if user tries to share with groups they are not a member of', async () => {
    const invalidGroupId = 'c3d4e5f6-a7b8-9012-cdef-999999999999';
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.shareDocument({
      documentId: mockDocumentId,
      userGroupIds: [mockGroupId1, invalidGroupId],
    })).rejects.toThrow(
      BadRequest('You can only share with user groups you are a member of')
    );

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('groups they are not a member of'),
      event: AuditRecordEvent.ShareDocumentLibraryData,
    });
  });
});
