import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import dataSourcesRouter from '@/features/settings/routes/data-sources';
import getAdminDocuments from '@/features/shared/dal/document-library/upload/getAdminDocuments';
import db from '@/server/db';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('@/features/shared/dal/document-library/upload/getAdminDocuments');
jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findFirst: jest.fn(),
  },
}));

describe('get-admin-documents route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns admin documents for admin user', async () => {
    const now = new Date();
    const mockDocuments = [
      {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        userId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        filename: 'file1.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: true,
        assignedGroupIds: ['c3d4e5f6-a7b8-9012-cdef-123456789012'],
        userName: 'John Doe',
        userEmail: 'john@example.com',
        userGroupMemberships: [
          { id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', label: 'Group 1' },
        ],
      },
    ];
    (getAdminDocuments as jest.Mock).mockResolvedValue(mockDocuments);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);
    const response = await caller.getAdminDocuments();

    expect(response).toEqual({ documents: mockDocuments });
    expect(getAdminDocuments).toHaveBeenCalledWith({ userId: mockUserId, isAdmin: true });
    expect(db.userGroupMembership.findFirst).not.toHaveBeenCalled();
  });

  it('returns admin documents for group lead user', async () => {
    const now = new Date();
    const mockDocuments = [
      {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        userId: mockUserId,
        filename: 'file1.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: true,
        assignedGroupIds: ['c3d4e5f6-a7b8-9012-cdef-123456789012'],
        userName: 'Jane Smith',
        userGroupMemberships: [
          { id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', label: 'Group 1' },
        ],
      },
    ];
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      role: UserGroupRole.Lead,
    });
    (getAdminDocuments as jest.Mock).mockResolvedValue(mockDocuments);

    const caller = dataSourcesRouter.createCaller(mockGroupLeadCtx);
    const response = await caller.getAdminDocuments();

    expect(response).toEqual({ documents: mockDocuments });
    expect(db.userGroupMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: mockUserId, role: UserGroupRole.Lead },
    });
    expect(getAdminDocuments).toHaveBeenCalledWith({ userId: mockUserId, isAdmin: false });
  });

  it('throws Forbidden error when user is not admin or group lead', async () => {
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const caller = dataSourcesRouter.createCaller(mockUserCtx);

    await expect(caller.getAdminDocuments()).rejects.toThrow(
      Forbidden('You do not have permission to view admin data sources')
    );

    expect(db.userGroupMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: mockUserId, role: UserGroupRole.Lead },
    });
    expect(getAdminDocuments).not.toHaveBeenCalled();
  });

  it('throws an error if getAdminDocuments fails', async () => {
    const error = new Error('DAL error');
    (getAdminDocuments as jest.Mock).mockRejectedValue(error);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.getAdminDocuments()).rejects.toThrow(error.message);

    expect(getAdminDocuments).toHaveBeenCalled();
  });
});
