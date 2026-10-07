import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import dataSourcesRouter from '@/features/settings/routes/data-sources';
import promoteDocumentToAdminSource from '@/features/shared/dal/document-library/upload/promoteDocumentToAdminSource';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';

jest.mock('@/features/shared/dal/document-library/upload/promoteDocumentToAdminSource');
jest.mock('@/features/settings/dal/shared/getUser');
jest.mock('@/server/db', () => ({
  document: {
    findUnique: jest.fn(),
  },
  userGroupMembership: {
    findFirst: jest.fn(),
  },
  userGroup: {
    findMany: jest.fn(),
  },
  documentCollection: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
}));

describe('promote-admin-document route', () => {
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
    userGroupIds: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getUser as jest.Mock).mockResolvedValue({ id: mockUserId, name: 'Test User', email: 'test@example.com' });
    (db.userGroup.findMany as jest.Mock).mockResolvedValue([
      { label: 'Group 1' },
      { label: 'Group 2' },
    ]);
    (db.$transaction as jest.Mock).mockImplementation(async (callback) => callback(db));
  });

  it('promotes document successfully for admin user', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: false,
      userId: mockOtherUserId,
      filename: 'test-document.pdf',
    });
    (promoteDocumentToAdminSource as jest.Mock).mockResolvedValue(undefined);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);
    const response = await caller.promoteFromLibrary(mockInput);

    expect(response).toEqual({ success: true });
    expect(db.document.findUnique).toHaveBeenCalledWith({
      where: { id: mockDocumentId },
      select: { id: true, adminCreated: true, userId: true, filename: true },
    });
    expect(promoteDocumentToAdminSource).toHaveBeenCalledWith({
      documentId: mockDocumentId,
      userGroupIds: mockInput.userGroupIds,
      tx: db,
    });
    expect(db.userGroupMembership.findFirst).not.toHaveBeenCalled();
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'User Test User promoted document "test-document.pdf" to admin data source for groups: Group 1, Group 2',
      event: AuditRecordEvent.PromoteDocumentToAdminDataSource,
    });
  });

  it('promotes document successfully for group lead who owns the document', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: false,
      userId: mockUserId,
      filename: 'test-document.pdf',
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: 'group-1',
      role: UserGroupRole.Lead,
    });
    (promoteDocumentToAdminSource as jest.Mock).mockResolvedValue(undefined);

    const caller = dataSourcesRouter.createCaller(mockGroupLeadCtx);
    const response = await caller.promoteFromLibrary(mockInput);

    expect(response).toEqual({ success: true });
    expect(db.userGroupMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: mockUserId, role: UserGroupRole.Lead },
    });
    expect(promoteDocumentToAdminSource).toHaveBeenCalledWith({
      documentId: mockDocumentId,
      userGroupIds: mockInput.userGroupIds,
      tx: db,
    });
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'User Test User promoted document "test-document.pdf" to admin data source for groups: Group 1, Group 2',
      event: AuditRecordEvent.PromoteDocumentToAdminDataSource,
    });
  });

  it('throws NotFound error when document does not exist', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue(null);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.promoteFromLibrary(mockInput)).rejects.toThrow(NotFound('Document not found'));

    expect(promoteDocumentToAdminSource).not.toHaveBeenCalled();
  });

  it('throws Forbidden error when document is already admin created', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: true,
      userId: mockUserId,
    });

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.promoteFromLibrary(mockInput)).rejects.toThrow(
      Forbidden('Document is already an admin data source')
    );

    expect(promoteDocumentToAdminSource).not.toHaveBeenCalled();
  });

  it('throws Forbidden error when non-admin user does not own the document', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: false,
      userId: mockOtherUserId,
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: 'group-1',
      role: UserGroupRole.Lead,
    });

    const caller = dataSourcesRouter.createCaller(mockGroupLeadCtx);

    await expect(caller.promoteFromLibrary(mockInput)).rejects.toThrow(
      Forbidden('You do not have permission to promote this document')
    );

    expect(promoteDocumentToAdminSource).not.toHaveBeenCalled();
  });

  it('throws Forbidden error when non-admin user is not a group lead', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: false,
      userId: mockUserId,
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const caller = dataSourcesRouter.createCaller(mockUserCtx);

    await expect(caller.promoteFromLibrary(mockInput)).rejects.toThrow(
      Forbidden('You do not have permission to promote documents to admin data sources')
    );

    expect(promoteDocumentToAdminSource).not.toHaveBeenCalled();
  });

  it('rejects invalid documentId input', async () => {
    const invalidInput = { documentId: 'invalid-uuid', userGroupIds: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'] };

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.promoteFromLibrary(invalidInput)).rejects.toThrow();

    expect(db.document.findUnique).not.toHaveBeenCalled();
    expect(promoteDocumentToAdminSource).not.toHaveBeenCalled();
  });

  it('rejects empty userGroupIds array', async () => {
    const invalidInput = { documentId: mockDocumentId, userGroupIds: [] };

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.promoteFromLibrary(invalidInput)).rejects.toThrow();

    expect(db.document.findUnique).not.toHaveBeenCalled();
    expect(promoteDocumentToAdminSource).not.toHaveBeenCalled();
  });

  it('throws an error if promoteDocumentToAdminSource fails', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: false,
      userId: mockUserId,
      filename: 'test-document.pdf',
    });
    const error = new Error('DAL error');
    (promoteDocumentToAdminSource as jest.Mock).mockRejectedValue(error);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.promoteFromLibrary(mockInput)).rejects.toThrow(error.message);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Error,
      description: 'User Test User failed to promote document "test-document.pdf" to admin data source - DAL error',
      event: AuditRecordEvent.PromoteDocumentToAdminDataSource,
    });
  });

  describe('audit logging', () => {
    it('logs successful promotion with correct details', async () => {
      (db.document.findUnique as jest.Mock).mockResolvedValue({
        id: mockDocumentId,
        adminCreated: false,
        userId: mockUserId,
        filename: 'important-document.pdf',
      });
      (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        userGroupId: 'group-1',
        role: UserGroupRole.Lead,
      });
      (promoteDocumentToAdminSource as jest.Mock).mockResolvedValue(undefined);

      const caller = dataSourcesRouter.createCaller(mockGroupLeadCtx);
      await caller.promoteFromLibrary(mockInput);

      expect(mockAuditor.createAuditRecord).toHaveBeenCalledTimes(1);
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: expect.stringContaining('Test User'),
        event: AuditRecordEvent.PromoteDocumentToAdminDataSource,
      });
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: expect.stringContaining('important-document.pdf'),
        event: AuditRecordEvent.PromoteDocumentToAdminDataSource,
      });
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: expect.stringContaining('Group 1, Group 2'),
        event: AuditRecordEvent.PromoteDocumentToAdminDataSource,
      });
    });

    it('logs error when promotion fails', async () => {
      (db.document.findUnique as jest.Mock).mockResolvedValue({
        id: mockDocumentId,
        adminCreated: false,
        userId: mockUserId,
        filename: 'failed-document.pdf',
      });
      const error = new Error('Database connection failed');
      (promoteDocumentToAdminSource as jest.Mock).mockRejectedValue(error);

      const caller = dataSourcesRouter.createCaller(mockAdminCtx);

      await expect(caller.promoteFromLibrary(mockInput)).rejects.toThrow('Database connection failed');
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Error,
        description: expect.stringContaining('failed-document.pdf'),
        event: AuditRecordEvent.PromoteDocumentToAdminDataSource,
      });
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Error,
        description: expect.stringContaining('Database connection failed'),
        event: AuditRecordEvent.PromoteDocumentToAdminDataSource,
      });
    });
  });

  describe('Collection promotion', () => {
    const mockCollectionId = '8c92f044-da78-43d4-91aa-5fbeffcb3e77';
    const mockDoc1Id = '1b91f044-da78-43d4-91aa-5fbeffcb3e71';
    const mockDoc2Id = '2b91f044-da78-43d4-91aa-5fbeffcb3e72';

    const mockCollectionInput = {
      collectionId: mockCollectionId,
      userGroupIds: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
    };

    it('promotes collection successfully for admin user', async () => {
      (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({
        id: mockCollectionId,
        name: 'Test Collection',
        color: '#228BE6',
        userId: mockUserId,
        memberships: [
          {
            document: {
              id: mockDoc1Id,
              adminCreated: false,
              userId: mockUserId,
              filename: 'doc1.pdf',
            },
          },
          {
            document: {
              id: mockDoc2Id,
              adminCreated: false,
              userId: mockUserId,
              filename: 'doc2.pdf',
            },
          },
        ],
      });
      (promoteDocumentToAdminSource as jest.Mock).mockResolvedValue(undefined);

      const mockTx = {
        documentCollection: {
          update: jest.fn().mockResolvedValue({ id: mockCollectionId, adminCreated: true }),
        },
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));

      const caller = dataSourcesRouter.createCaller(mockAdminCtx);
      const response = await caller.promoteFromLibrary(mockCollectionInput);

      expect(response).toEqual({ success: true });
      expect(db.documentCollection.findUnique).toHaveBeenCalledWith({
        where: { id: mockCollectionId },
        select: {
          id: true,
          name: true,
          userId: true,
          memberships: {
            include: {
              document: {
                select: { id: true, adminCreated: true, userId: true, filename: true },
              },
            },
          },
        },
      });
      expect(promoteDocumentToAdminSource).toHaveBeenCalledTimes(2);
      // Flag model: the source folder is marked shared (read-only to recipients);
      // NO per-recipient collections or memberships are created.
      expect(mockTx.documentCollection.update).toHaveBeenCalledWith({
        where: { id: mockCollectionId },
        data: { adminCreated: true },
      });
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: expect.stringContaining('Test Collection'),
        event: AuditRecordEvent.PromoteDocumentCollectionToAdminDataSource,
      });
    });

    it('re-assigns groups for already-admin documents when re-sharing a folder', async () => {
      (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({
        id: mockCollectionId,
        name: 'Test Collection',
        color: '#228BE6',
        userId: mockUserId,
        memberships: [
          {
            document: {
              id: mockDoc1Id,
              adminCreated: true, // already shared — must still be re-processed
              userId: mockUserId,
              filename: 'doc1.pdf',
            },
          },
          {
            document: {
              id: mockDoc2Id,
              adminCreated: false,
              userId: mockUserId,
              filename: 'doc2.pdf',
            },
          },
        ],
      });
      (promoteDocumentToAdminSource as jest.Mock).mockResolvedValue(undefined);

      const mockTx = {
        documentCollection: {
          update: jest.fn().mockResolvedValue({ id: mockCollectionId, adminCreated: true }),
        },
      };
      (db.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));

      const caller = dataSourcesRouter.createCaller(mockAdminCtx);
      const response = await caller.promoteFromLibrary(mockCollectionInput);

      expect(response).toEqual({ success: true });
      // Both documents are processed, including the one that is already an admin source.
      expect(promoteDocumentToAdminSource).toHaveBeenCalledTimes(2);
      expect(promoteDocumentToAdminSource).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: mockDoc1Id, userGroupIds: mockCollectionInput.userGroupIds })
      );
    });

    it('throws error when collection not found', async () => {
      (db.documentCollection.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = dataSourcesRouter.createCaller(mockAdminCtx);

      await expect(caller.promoteFromLibrary(mockCollectionInput)).rejects.toThrow('Collection not found');
    });

    it('throws error when non-admin non-group-lead tries to promote collection', async () => {
      (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({
        id: mockCollectionId,
        name: 'Test Collection',
        color: '#228BE6',
        userId: mockUserId,
        memberships: [
          {
            document: {
              id: mockDoc1Id,
              adminCreated: false,
              userId: mockUserId,
              filename: 'doc1.pdf',
            },
          },
        ],
      });
      (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);

      const caller = dataSourcesRouter.createCaller(mockUserCtx);

      await expect(caller.promoteFromLibrary(mockCollectionInput)).rejects.toThrow('You do not have permission to promote documents to admin data sources');
    });

    it('throws error when collection has no documents to promote', async () => {
      (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({
        id: mockCollectionId,
        name: 'Empty Collection',
        color: '#228BE6',
        userId: mockUserId,
        memberships: [],
      });

      const caller = dataSourcesRouter.createCaller(mockAdminCtx);

      await expect(caller.promoteFromLibrary(mockCollectionInput)).rejects.toThrow('No documents in collection to promote');
    });

    it('throws Forbidden error when non-admin user does not own the collection', async () => {
      (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({
        id: mockCollectionId,
        name: 'Test Collection',
        color: '#228BE6',
        userId: mockOtherUserId,
        memberships: [
          {
            document: {
              id: mockDoc1Id,
              adminCreated: false,
              userId: mockOtherUserId,
              filename: 'doc1.pdf',
            },
          },
        ],
      });
      (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        userGroupId: 'group-1',
        role: UserGroupRole.Lead,
      });

      const caller = dataSourcesRouter.createCaller(mockGroupLeadCtx);

      await expect(caller.promoteFromLibrary(mockCollectionInput)).rejects.toThrow(
        Forbidden('You do not have permission to promote this collection')
      );

      expect(promoteDocumentToAdminSource).not.toHaveBeenCalled();
    });

    it('allows admin to promote any collection regardless of ownership', async () => {
      (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({
        id: mockCollectionId,
        name: 'Other User Collection',
        color: '#228BE6',
        userId: mockOtherUserId,
        memberships: [
          {
            document: {
              id: mockDoc1Id,
              adminCreated: false,
              userId: mockUserId,
              filename: 'doc1.pdf',
            },
          },
        ],
      });
      (promoteDocumentToAdminSource as jest.Mock).mockResolvedValue(undefined);

      const mockTx = {
        documentCollection: {
          update: jest.fn().mockResolvedValue({ id: mockCollectionId, adminCreated: true }),
        },
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));

      const caller = dataSourcesRouter.createCaller(mockAdminCtx);
      const response = await caller.promoteFromLibrary(mockCollectionInput);

      expect(response).toEqual({ success: true });
      expect(promoteDocumentToAdminSource).toHaveBeenCalled();
    });

    it('allows admin to promote collection with documents owned by other users', async () => {
      (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({
        id: mockCollectionId,
        name: 'Other User Collection',
        color: '#228BE6',
        userId: mockOtherUserId,
        memberships: [
          {
            document: {
              id: mockDoc1Id,
              adminCreated: false,
              userId: mockOtherUserId,
              filename: 'other-user-doc.pdf',
            },
          },
        ],
      });
      (promoteDocumentToAdminSource as jest.Mock).mockResolvedValue(undefined);

      const mockTx = {
        documentCollection: {
          update: jest.fn().mockResolvedValue({ id: mockCollectionId, adminCreated: true }),
        },
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));

      const caller = dataSourcesRouter.createCaller(mockAdminCtx);
      const response = await caller.promoteFromLibrary(mockCollectionInput);

      expect(response).toEqual({ success: true });
      expect(promoteDocumentToAdminSource).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: mockDoc1Id,
          userGroupIds: mockCollectionInput.userGroupIds,
        })
      );
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: expect.stringContaining('Other User Collection'),
        event: AuditRecordEvent.PromoteDocumentCollectionToAdminDataSource,
      });
    });
  });
});
