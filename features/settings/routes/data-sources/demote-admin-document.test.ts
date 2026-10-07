import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import dataSourcesRouter from '@/features/settings/routes/data-sources';
import demoteAdminDocument from '@/features/shared/dal/document-library/upload/demoteAdminDocument';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';

jest.mock('@/features/shared/dal/document-library/upload/demoteAdminDocument');
jest.mock('@/features/settings/dal/shared/getUser');
jest.mock('@/server/db', () => ({
  document: {
    findUnique: jest.fn(),
  },
  userGroupMembership: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback({})),
}));

describe('demote-admin-document route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockDocumentId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';
  const mockOtherUserId = 'dc3cc2cf-c867-4a81-b940-d22d98544a0c';

  const mockAuditor = {
    createAuditRecord: jest.fn(),
  };

  const mockAdminCtx = {
    userId: mockUserId,
    userRole: UserRole.Admin,
    logger: logger,
    auditor: mockAuditor,
  } as unknown as ContextType;

  const mockGroupLeadCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
    logger: logger,
    auditor: mockAuditor,
  } as unknown as ContextType;

  const mockUserCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
    logger: logger,
    auditor: mockAuditor,
  } as unknown as ContextType;

  const mockInput = {
    documentId: mockDocumentId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getUser as jest.Mock).mockResolvedValue({ id: mockUserId, name: 'Test User', email: 'test@example.com' });
  });

  it('demotes admin document successfully for admin user', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: true,
      userId: mockOtherUserId,
      filename: 'test-document.pdf',
    });
    (demoteAdminDocument as jest.Mock).mockResolvedValue(undefined);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);
    const response = await caller.demoteAdminDocument(mockInput);

    expect(response).toEqual({ id: mockDocumentId });
    expect(db.document.findUnique).toHaveBeenCalledWith({
      where: { id: mockDocumentId },
      select: { id: true, adminCreated: true, userId: true, filename: true },
    });
    expect(demoteAdminDocument).toHaveBeenCalledWith(mockDocumentId, expect.anything());
    expect(db.userGroupMembership.findFirst).not.toHaveBeenCalled();
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'User Test User demoted document "test-document.pdf" from admin data source',
      event: AuditRecordEvent.DemoteDocumentFromAdminDataSource,
    });
  });

  it('demotes admin document successfully for group lead who owns the document', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: true,
      userId: mockUserId,
      filename: 'test-document.pdf',
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: 'group-1',
      role: UserGroupRole.Lead,
    });
    (demoteAdminDocument as jest.Mock).mockResolvedValue(undefined);

    const caller = dataSourcesRouter.createCaller(mockGroupLeadCtx);
    const response = await caller.demoteAdminDocument(mockInput);

    expect(response).toEqual({ id: mockDocumentId });
    expect(db.userGroupMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: mockUserId, role: UserGroupRole.Lead },
    });
    expect(demoteAdminDocument).toHaveBeenCalledWith(mockDocumentId, expect.anything());
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'User Test User demoted document "test-document.pdf" from admin data source',
      event: AuditRecordEvent.DemoteDocumentFromAdminDataSource,
    });
  });

  it('throws NotFound error when document does not exist', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue(null);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.demoteAdminDocument(mockInput)).rejects.toThrow(NotFound('Admin data source not found'));

    expect(demoteAdminDocument).not.toHaveBeenCalled();
  });

  it('throws NotFound error when document is not admin created', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: false,
      userId: mockUserId,
    });

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.demoteAdminDocument(mockInput)).rejects.toThrow(NotFound('Admin data source not found'));

    expect(demoteAdminDocument).not.toHaveBeenCalled();
  });

  it('throws Forbidden error when non-admin user does not own the document', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: true,
      userId: mockOtherUserId,
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: 'group-1',
      role: UserGroupRole.Lead,
    });

    const caller = dataSourcesRouter.createCaller(mockGroupLeadCtx);

    await expect(caller.demoteAdminDocument(mockInput)).rejects.toThrow(
      Forbidden('You do not have permission to delete this data source')
    );

    expect(demoteAdminDocument).not.toHaveBeenCalled();
  });

  it('throws Forbidden error when non-admin user is not a group lead', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: true,
      userId: mockUserId,
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const caller = dataSourcesRouter.createCaller(mockUserCtx);

    await expect(caller.demoteAdminDocument(mockInput)).rejects.toThrow(
      Forbidden('You do not have permission to delete this data source')
    );

    expect(demoteAdminDocument).not.toHaveBeenCalled();
  });

  it('rejects invalid documentId input', async () => {
    const invalidInput = { documentId: 'invalid-uuid' };

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.demoteAdminDocument(invalidInput)).rejects.toThrow();

    expect(db.document.findUnique).not.toHaveBeenCalled();
    expect(demoteAdminDocument).not.toHaveBeenCalled();
  });

  it('throws an error if demoteAdminDocument fails', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: true,
      userId: mockUserId,
      filename: 'test-document.pdf',
    });
    const error = new Error('DAL error');
    (demoteAdminDocument as jest.Mock).mockRejectedValue(error);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.demoteAdminDocument(mockInput)).rejects.toThrow(error.message);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Error,
      description: 'User Test User failed to demote document "test-document.pdf" from admin data source - DAL error',
      event: AuditRecordEvent.DemoteDocumentFromAdminDataSource,
    });
  });

  describe('audit logging', () => {
    it('logs successful demotion with correct details', async () => {
      (db.document.findUnique as jest.Mock).mockResolvedValue({
        id: mockDocumentId,
        adminCreated: true,
        userId: mockUserId,
        filename: 'important-document.pdf',
      });
      (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        userGroupId: 'group-1',
        role: UserGroupRole.Lead,
      });
      (demoteAdminDocument as jest.Mock).mockResolvedValue(undefined);

      const caller = dataSourcesRouter.createCaller(mockGroupLeadCtx);
      await caller.demoteAdminDocument(mockInput);

      expect(mockAuditor.createAuditRecord).toHaveBeenCalledTimes(1);
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: expect.stringContaining('Test User'),
        event: AuditRecordEvent.DemoteDocumentFromAdminDataSource,
      });
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: expect.stringContaining('important-document.pdf'),
        event: AuditRecordEvent.DemoteDocumentFromAdminDataSource,
      });
    });

    it('logs error when demotion fails', async () => {
      (db.document.findUnique as jest.Mock).mockResolvedValue({
        id: mockDocumentId,
        adminCreated: true,
        userId: mockUserId,
        filename: 'failed-document.pdf',
      });
      const error = new Error('Database connection failed');
      (demoteAdminDocument as jest.Mock).mockRejectedValue(error);

      const caller = dataSourcesRouter.createCaller(mockAdminCtx);

      await expect(caller.demoteAdminDocument(mockInput)).rejects.toThrow('Database connection failed');
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Error,
        description: expect.stringContaining('failed-document.pdf'),
        event: AuditRecordEvent.DemoteDocumentFromAdminDataSource,
      });
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Error,
        description: expect.stringContaining('Database connection failed'),
        event: AuditRecordEvent.DemoteDocumentFromAdminDataSource,
      });
    });
  });
});
