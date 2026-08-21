import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import dataSourcesRouter from '@/features/settings/routes/data-sources';
import createAdminDocument from '@/features/shared/dal/document-library/upload/createAdminDocument';
import assignAdminDocumentGroups from '@/features/shared/dal/document-library/upload/assignAdminDocumentGroups';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import db from '@/server/db';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';
import { DocumentUploadStatus } from '@/features/shared/types/document';
import { storage } from '@/server/storage/redis';
import { getDocumentQueue } from '@/features/document-upload-provider/workers/documentQueue';
import crypto from 'crypto';

jest.mock('@/features/shared/dal/document-library/upload/createAdminDocument');
jest.mock('@/features/shared/dal/document-library/upload/assignAdminDocumentGroups');
jest.mock('@/features/shared/dal/getSystemConfig');
jest.mock('@/features/document-upload-provider/workers/documentQueue');
jest.mock('@/server/storage/redis', () => ({
  storage: {
    hset: jest.fn(),
  },
}));
jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  userGroup: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(async (callback) => {
    const mockTx = {};
    return await callback(mockTx);
  }),
}));
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(),
}));

describe('create-admin-document route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockDocumentId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';
  const mockJobId = 'job-123';

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
    fileName: 'test-document.pdf',
    contentType: 'application/pdf',
    fileSize: 1024000,
    fileKey: 'uploads/test-document.pdf',
    userGroupIds: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'],
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (crypto.randomUUID as jest.Mock).mockReturnValue(mockJobId);
  });

  it('creates admin document successfully for admin user with queue', async () => {
    const now = new Date();
    const mockDocument = {
      id: mockDocumentId,
      userId: mockUserId,
      filename: mockInput.fileName,
      uploadStatus: DocumentUploadStatus.Pending,
      createdAt: now,
      adminCreated: true,
    };
    const mockUser = {
      name: 'John Doe',
      email: 'john@example.com',
    };
    const mockUserGroups = [
      { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', label: 'Group 1' },
      { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', label: 'Group 2' },
    ];

    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: 'provider-123',
    });
    (createAdminDocument as jest.Mock).mockResolvedValue(mockDocument);
    (assignAdminDocumentGroups as jest.Mock).mockResolvedValue(undefined);
    (db.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (db.userGroup.findMany as jest.Mock).mockResolvedValue(mockUserGroups);
    (getDocumentQueue as jest.Mock).mockReturnValue(mockQueue);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);
    const response = await caller.createAdminDocument(mockInput);

    expect(response).toEqual({
      document: {
        ...mockDocument,
        assignedGroupIds: mockInput.userGroupIds,
        userName: 'John Doe',
        userEmail: 'john@example.com',
        userGroupMemberships: mockUserGroups,
      },
      jobId: mockJobId,
    });
    expect(getSystemConfig).toHaveBeenCalled();
    expect(createAdminDocument).toHaveBeenCalledWith({
      userId: mockUserId,
      filename: mockInput.fileName,
      documentUploadProviderId: 'provider-123',
    });
    expect(assignAdminDocumentGroups).toHaveBeenCalledWith({
      documentId: mockDocumentId,
      userGroupIds: mockInput.userGroupIds,
      tx: expect.any(Object),
    });
    expect(storage.hset).toHaveBeenCalledWith(`document-job:${mockJobId}`, {
      status: 'queued',
      created: expect.any(Number),
      progress: 'File uploaded, queued for processing...',
      documentId: mockDocumentId,
      documentUploadProviderId: 'provider-123',
      fileKey: mockInput.fileKey,
      fileName: mockInput.fileName,
      contentType: mockInput.contentType,
      fileSize: mockInput.fileSize.toString(),
      userId: mockUserId,
    });
    expect(mockQueue.add).toHaveBeenCalledWith('documentProcessingJob', {
      documentId: mockDocumentId,
      documentUploadProviderId: 'provider-123',
      jobId: mockJobId,
      userId: mockUserId,
      fileKey: mockInput.fileKey,
      fileName: mockInput.fileName,
      contentType: mockInput.contentType,
      fileSize: mockInput.fileSize,
    });
  });

  it('creates admin document successfully for group lead user', async () => {
    const now = new Date();
    const mockDocument = {
      id: mockDocumentId,
      userId: mockUserId,
      filename: mockInput.fileName,
      uploadStatus: DocumentUploadStatus.Pending,
      createdAt: now,
      adminCreated: true,
    };
    const mockUser = {
      name: 'Jane Smith',
      email: null,
    };
    const mockUserGroups = [
      { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', label: 'Group 1' },
      { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', label: 'Group 2' },
    ];

    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: 'provider-123',
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: 'group-1',
      role: UserGroupRole.Lead,
    });
    (createAdminDocument as jest.Mock).mockResolvedValue(mockDocument);
    (assignAdminDocumentGroups as jest.Mock).mockResolvedValue(undefined);
    (db.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (db.userGroup.findMany as jest.Mock).mockResolvedValue(mockUserGroups);
    (getDocumentQueue as jest.Mock).mockReturnValue(mockQueue);

    const caller = dataSourcesRouter.createCaller(mockGroupLeadCtx);
    const response = await caller.createAdminDocument(mockInput);

    expect(response).toEqual({
      document: {
        ...mockDocument,
        assignedGroupIds: mockInput.userGroupIds,
        userName: 'Jane Smith',
        userEmail: undefined,
        userGroupMemberships: mockUserGroups,
      },
      jobId: mockJobId,
    });
    expect(db.userGroupMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: mockUserId, role: UserGroupRole.Lead },
    });
  });

  it('creates admin document without queue when queue is not available', async () => {
    const now = new Date();
    const mockDocument = {
      id: mockDocumentId,
      userId: mockUserId,
      filename: mockInput.fileName,
      uploadStatus: DocumentUploadStatus.Pending,
      createdAt: now,
      adminCreated: true,
    };
    const mockUser = {
      name: 'John Doe',
      email: 'john@example.com',
    };
    const mockUserGroups = [
      { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', label: 'Group 1' },
      { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', label: 'Group 2' },
    ];

    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: 'provider-123',
    });
    (createAdminDocument as jest.Mock).mockResolvedValue(mockDocument);
    (assignAdminDocumentGroups as jest.Mock).mockResolvedValue(undefined);
    (db.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (db.userGroup.findMany as jest.Mock).mockResolvedValue(mockUserGroups);
    (getDocumentQueue as jest.Mock).mockReturnValue(null);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);
    const response = await caller.createAdminDocument(mockInput);

    expect(response).toEqual({
      document: {
        ...mockDocument,
        assignedGroupIds: mockInput.userGroupIds,
        userName: 'John Doe',
        userEmail: 'john@example.com',
        userGroupMemberships: mockUserGroups,
      },
      jobId: null,
    });
    expect(storage.hset).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('throws Forbidden error when user is not admin or group lead', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: 'provider-123',
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const caller = dataSourcesRouter.createCaller(mockUserCtx);

    await expect(caller.createAdminDocument(mockInput)).rejects.toThrow(
      Forbidden('You do not have permission to create admin data sources')
    );

    expect(createAdminDocument).not.toHaveBeenCalled();
  });

  it('throws BadRequest error when no document upload provider is configured', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: null,
    });

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.createAdminDocument(mockInput)).rejects.toThrow(
      BadRequest('No document upload provider is configured')
    );

    expect(createAdminDocument).not.toHaveBeenCalled();
  });

  it('rejects empty userGroupIds array', async () => {
    const invalidInput = { ...mockInput, userGroupIds: [] };

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.createAdminDocument(invalidInput)).rejects.toThrow();

    expect(createAdminDocument).not.toHaveBeenCalled();
  });

  it('throws an error if createAdminDocument fails', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: 'provider-123',
    });
    const error = new Error('DAL error');
    (createAdminDocument as jest.Mock).mockRejectedValue(error);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.createAdminDocument(mockInput)).rejects.toThrow(error.message);
  });
});
