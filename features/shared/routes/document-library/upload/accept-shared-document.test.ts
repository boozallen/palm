import { ContextType } from '@/server/trpc-context';
import sharedRouter from '@/features/shared/routes';
import acceptSharedDocument from '@/features/shared/dal/document-library/upload/acceptSharedDocument';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import { BadRequest } from '@/features/shared/errors/routeErrors';
import { SharedDocumentActionStatus } from '@/features/shared/types/document';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import logger from '@/server/logger';

jest.mock('@/features/shared/dal/document-library/upload/acceptSharedDocument');
jest.mock('@/features/profile/dal/getUserGroups');

describe('acceptSharedDocument', () => {
  const mockUserId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
  const mockSharedDocumentId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockGroupId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const mockCopiedDocId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
  const mockActionId = 'd4e5f6a7-b8c9-0123-def0-234567890123';
  const mockCreatedAt = new Date();

  const mockAuditor = {
    createAuditRecord: jest.fn(),
  };

  const ctx = {
    userId: mockUserId,
    logger,
    auditor: mockAuditor,
  } as unknown as ContextType;

  const mockUserGroups = [
    { id: mockGroupId, label: 'Group 1', role: 'User' },
  ];

  const mockAction = {
    id: mockActionId,
    sharedDocumentId: mockSharedDocumentId,
    copiedDocumentId: mockCopiedDocId,
    userId: mockUserId,
    status: SharedDocumentActionStatus.Accepted,
    createdAt: mockCreatedAt,
  };

  const mockAcceptResult = {
    action: mockAction,
    filename: 'test-document.pdf',
    graphCopyJobId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should accept shared document successfully', async () => {
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (acceptSharedDocument as jest.Mock).mockResolvedValue(mockAcceptResult);

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.acceptSharedDocument({
      sharedDocumentId: mockSharedDocumentId,
    });

    expect(result).toEqual(mockAcceptResult);

    expect(getUserGroups).toHaveBeenCalledWith(mockUserId);
    expect(acceptSharedDocument).toHaveBeenCalledWith({
      sharedDocumentId: mockSharedDocumentId,
      userId: mockUserId,
      userGroupIds: [mockGroupId],
    });
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: expect.stringContaining('accepted shared document'),
      event: AuditRecordEvent.AcceptDocumentLibraryDataShare,
    });
  });

  it('should throw BadRequest if user has no groups', async () => {
    (getUserGroups as jest.Mock).mockResolvedValue([]);

    const caller = sharedRouter.createCaller(ctx);
    await expect(
      caller.acceptSharedDocument({ sharedDocumentId: mockSharedDocumentId })
    ).rejects.toThrow(BadRequest('You must be a member of a user group to accept shared documents'));

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('not a member of any user groups'),
      event: AuditRecordEvent.AcceptDocumentLibraryDataShare,
    });
  });

  it('should audit error on DAL failure', async () => {
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (acceptSharedDocument as jest.Mock).mockRejectedValue(
      new Error('Shared document not found')
    );

    const caller = sharedRouter.createCaller(ctx);
    await expect(
      caller.acceptSharedDocument({ sharedDocumentId: mockSharedDocumentId })
    ).rejects.toThrow('Shared document not found');

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Error,
      description: expect.stringContaining('failed to accept'),
      event: AuditRecordEvent.AcceptDocumentLibraryDataShare,
    });
  });
});
