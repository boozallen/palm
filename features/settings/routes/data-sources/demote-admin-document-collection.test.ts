import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import dataSourcesRouter from '@/features/settings/routes/data-sources';
import demoteCollection from '@/features/shared/dal/document-library/upload/demoteCollection';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';

jest.mock('@/features/shared/dal/document-library/upload/demoteCollection');
jest.mock('@/features/settings/dal/shared/getUser');
jest.mock('@/server/db', () => ({
  documentCollection: {
    findUnique: jest.fn(),
  },
}));

describe('demote-admin-document-collection route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockOtherUserId = 'dc3cc2cf-c867-4a81-b940-d22d98544a0c';
  const mockCollectionId = '8c92f044-da78-43d4-91aa-5fbeffcb3e77';

  const mockAuditor = {
    createAuditRecord: jest.fn(),
  };

  const mockAdminCtx = {
    userId: mockUserId,
    userRole: UserRole.Admin,
    logger,
    auditor: mockAuditor,
  } as unknown as ContextType;

  const mockUserCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
    logger,
    auditor: mockAuditor,
  } as unknown as ContextType;

  const mockInput = { collectionId: mockCollectionId };

  beforeEach(() => {
    jest.clearAllMocks();
    (getUser as jest.Mock).mockResolvedValue({ id: mockUserId, name: 'Test User', email: 'test@example.com' });
  });

  it('demotes a collection for an admin regardless of ownership', async () => {
    (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({
      id: mockCollectionId,
      name: 'Test Collection',
      userId: mockOtherUserId,
    });
    (demoteCollection as jest.Mock).mockResolvedValue({ demotedCount: 3 });

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);
    const response = await caller.demoteCollection(mockInput);

    expect(response).toEqual({ success: true, demotedCount: 3 });
    expect(demoteCollection).toHaveBeenCalledWith(mockCollectionId);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'User Test User demoted collection "Test Collection" from admin data source (3 documents)',
      event: AuditRecordEvent.DemoteDocumentCollectionFromAdminDataSource,
    });
  });

  it('demotes a collection for its owner', async () => {
    (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({
      id: mockCollectionId,
      name: 'My Collection',
      userId: mockUserId,
    });
    (demoteCollection as jest.Mock).mockResolvedValue({ demotedCount: 1 });

    const caller = dataSourcesRouter.createCaller(mockUserCtx);
    const response = await caller.demoteCollection(mockInput);

    expect(response).toEqual({ success: true, demotedCount: 1 });
    expect(demoteCollection).toHaveBeenCalledWith(mockCollectionId);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'User Test User demoted collection "My Collection" from admin data source (1 documents)',
      event: AuditRecordEvent.DemoteDocumentCollectionFromAdminDataSource,
    });
  });

  it('throws NotFound when the collection does not exist', async () => {
    (db.documentCollection.findUnique as jest.Mock).mockResolvedValue(null);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.demoteCollection(mockInput)).rejects.toThrow(NotFound('Collection not found'));
    expect(demoteCollection).not.toHaveBeenCalled();
  });

  it('throws Forbidden when a non-admin does not own the collection', async () => {
    (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({ id: mockCollectionId, userId: mockOtherUserId });

    const caller = dataSourcesRouter.createCaller(mockUserCtx);

    await expect(caller.demoteCollection(mockInput)).rejects.toThrow(
      Forbidden('You do not have permission to modify this collection')
    );
    expect(demoteCollection).not.toHaveBeenCalled();
  });

  it('rejects an invalid collectionId', async () => {
    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.demoteCollection({ collectionId: 'not-a-uuid' })).rejects.toThrow();
    expect(db.documentCollection.findUnique).not.toHaveBeenCalled();
  });

  describe('audit logging', () => {
    it('logs successful demotion with correct details', async () => {
      (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({
        id: mockCollectionId,
        name: 'Important Collection',
        userId: mockUserId,
      });
      (demoteCollection as jest.Mock).mockResolvedValue({ demotedCount: 5 });

      const caller = dataSourcesRouter.createCaller(mockUserCtx);
      await caller.demoteCollection(mockInput);

      expect(mockAuditor.createAuditRecord).toHaveBeenCalledTimes(1);
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: expect.stringContaining('Test User'),
        event: AuditRecordEvent.DemoteDocumentCollectionFromAdminDataSource,
      });
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: expect.stringContaining('Important Collection'),
        event: AuditRecordEvent.DemoteDocumentCollectionFromAdminDataSource,
      });
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Success,
        description: expect.stringContaining('5 documents'),
        event: AuditRecordEvent.DemoteDocumentCollectionFromAdminDataSource,
      });
    });

    it('logs error when demotion fails', async () => {
      (db.documentCollection.findUnique as jest.Mock).mockResolvedValue({
        id: mockCollectionId,
        name: 'Failed Collection',
        userId: mockUserId,
      });
      const error = new Error('Database connection failed');
      (demoteCollection as jest.Mock).mockRejectedValue(error);

      const caller = dataSourcesRouter.createCaller(mockAdminCtx);

      await expect(caller.demoteCollection(mockInput)).rejects.toThrow('Database connection failed');
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Error,
        description: expect.stringContaining('Failed Collection'),
        event: AuditRecordEvent.DemoteDocumentCollectionFromAdminDataSource,
      });
      expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
        outcome: AuditRecordOutcome.Error,
        description: expect.stringContaining('Database connection failed'),
        event: AuditRecordEvent.DemoteDocumentCollectionFromAdminDataSource,
      });
    });
  });
});
