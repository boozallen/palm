import { ContextType } from '@/server/trpc-context';
import sharedRouter from '@/features/shared/routes';
import rejectSharedDocument from '@/features/shared/dal/document-library/upload/rejectSharedDocument';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import { BadRequest } from '@/features/shared/errors/routeErrors';
import { SharedDocumentActionStatus } from '@/features/shared/types/document';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import logger from '@/server/logger';

jest.mock('@/features/shared/dal/document-library/upload/rejectSharedDocument');
jest.mock('@/features/profile/dal/getUserGroups');

describe('rejectSharedDocument', () => {
  const mockUserId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
  const mockSharedDocumentId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockGroupId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
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
    copiedDocumentId: undefined,
    userId: mockUserId,
    status: SharedDocumentActionStatus.Rejected,
    createdAt: mockCreatedAt,
  };

  const mockRejectResult = {
    action: mockAction,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject shared document successfully', async () => {
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (rejectSharedDocument as jest.Mock).mockResolvedValue(mockRejectResult);

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.rejectSharedDocument({
      sharedDocumentId: mockSharedDocumentId,
    });

    expect(result).toEqual(mockRejectResult);

    expect(getUserGroups).toHaveBeenCalledWith(mockUserId);
    expect(rejectSharedDocument).toHaveBeenCalledWith({
      sharedDocumentId: mockSharedDocumentId,
      userId: mockUserId,
      userGroupIds: [mockGroupId],
    });
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: expect.stringContaining('rejected shared document'),
      event: AuditRecordEvent.RejectDocumentLibraryDataShare,
    });
  });

  it('should throw BadRequest if user has no groups', async () => {
    (getUserGroups as jest.Mock).mockResolvedValue([]);

    const caller = sharedRouter.createCaller(ctx);
    await expect(
      caller.rejectSharedDocument({ sharedDocumentId: mockSharedDocumentId })
    ).rejects.toThrow(BadRequest('You must be a member of at least one user group'));

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Warn,
      description: expect.stringContaining('not a member of any user groups'),
      event: AuditRecordEvent.RejectDocumentLibraryDataShare,
    });
  });

  it('should audit error on DAL failure', async () => {
    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups);
    (rejectSharedDocument as jest.Mock).mockRejectedValue(
      new Error('Shared document not found')
    );

    const caller = sharedRouter.createCaller(ctx);
    await expect(
      caller.rejectSharedDocument({ sharedDocumentId: mockSharedDocumentId })
    ).rejects.toThrow('Shared document not found');

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Error,
      description: expect.stringContaining('failed to reject'),
      event: AuditRecordEvent.RejectDocumentLibraryDataShare,
    });
  });
});