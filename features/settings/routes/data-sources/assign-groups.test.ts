import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import dataSourcesRouter from '@/features/settings/routes/data-sources';
import assignAdminDocumentGroups from '@/features/shared/dal/document-library/upload/assignAdminDocumentGroups';
import db from '@/server/db';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';

jest.mock('@/features/shared/dal/document-library/upload/assignAdminDocumentGroups');
jest.mock('@/server/db', () => ({
  document: {
    findUnique: jest.fn(),
  },
  userGroupMembership: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(async (callback) => {
    const mockTx = {};
    return await callback(mockTx);
  }),
}));

describe('assign-groups route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockDocumentId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';
  const mockOtherUserId = 'dc3cc2cf-c867-4a81-b940-d22d98544a0c';

  const mockAdminCtx = {
    userId: mockUserId,
    userRole: UserRole.Admin,
    logger: logger,
  } as unknown as ContextType;

  const mockGroupLeadCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
    logger: logger,
  } as unknown as ContextType;

  const mockUserCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
    logger: logger,
  } as unknown as ContextType;

  const mockInput = {
    documentId: mockDocumentId,
    userGroupIds: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assigns groups successfully for admin user', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: true,
      userId: mockOtherUserId,
    });
    (assignAdminDocumentGroups as jest.Mock).mockResolvedValue(undefined);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);
    const response = await caller.assignGroups(mockInput);

    expect(response).toEqual({ success: true });
    expect(db.document.findUnique).toHaveBeenCalledWith({
      where: { id: mockDocumentId },
      select: { id: true, adminCreated: true, userId: true },
    });
    expect(assignAdminDocumentGroups).toHaveBeenCalledWith({
      documentId: mockDocumentId,
      userGroupIds: mockInput.userGroupIds,
      tx: expect.any(Object),
    });
    expect(db.userGroupMembership.findFirst).not.toHaveBeenCalled();
  });

  it('assigns groups successfully for group lead who owns the document', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: true,
      userId: mockUserId,
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: 'group-1',
      role: UserGroupRole.Lead,
    });
    (assignAdminDocumentGroups as jest.Mock).mockResolvedValue(undefined);

    const caller = dataSourcesRouter.createCaller(mockGroupLeadCtx);
    const response = await caller.assignGroups(mockInput);

    expect(response).toEqual({ success: true });
    expect(db.userGroupMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: mockUserId, role: UserGroupRole.Lead },
    });
    expect(assignAdminDocumentGroups).toHaveBeenCalledWith({
      documentId: mockDocumentId,
      userGroupIds: mockInput.userGroupIds,
      tx: expect.any(Object),
    });
  });

  it('throws NotFound error when document does not exist', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue(null);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.assignGroups(mockInput)).rejects.toThrow(NotFound('Admin data source not found'));

    expect(assignAdminDocumentGroups).not.toHaveBeenCalled();
  });

  it('throws NotFound error when document is not admin created', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: false,
      userId: mockUserId,
    });

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.assignGroups(mockInput)).rejects.toThrow(NotFound('Admin data source not found'));

    expect(assignAdminDocumentGroups).not.toHaveBeenCalled();
  });

  it('throws Forbidden error when non-admin user is not a group lead', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: true,
      userId: mockUserId,
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const caller = dataSourcesRouter.createCaller(mockUserCtx);

    await expect(caller.assignGroups(mockInput)).rejects.toThrow(
      Forbidden('You do not have permission to manage this data source')
    );

    expect(assignAdminDocumentGroups).not.toHaveBeenCalled();
  });

  it('throws Forbidden error when group lead does not own the document', async () => {
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

    await expect(caller.assignGroups(mockInput)).rejects.toThrow(
      Forbidden('You do not have permission to manage this data source')
    );

    expect(assignAdminDocumentGroups).not.toHaveBeenCalled();
  });

  it('rejects invalid documentId input', async () => {
    const invalidInput = { documentId: 'invalid-uuid', userGroupIds: ['group-1'] };

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.assignGroups(invalidInput)).rejects.toThrow();

    expect(db.document.findUnique).not.toHaveBeenCalled();
    expect(assignAdminDocumentGroups).not.toHaveBeenCalled();
  });

  it('throws an error if assignAdminDocumentGroups fails', async () => {
    (db.document.findUnique as jest.Mock).mockResolvedValue({
      id: mockDocumentId,
      adminCreated: true,
      userId: mockUserId,
    });
    const error = new Error('DAL error');
    (assignAdminDocumentGroups as jest.Mock).mockRejectedValue(error);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.assignGroups(mockInput)).rejects.toThrow(error.message);
  });
});
