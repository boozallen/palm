import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import dataSourcesRouter from '@/features/settings/routes/data-sources';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import db from '@/server/db';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';

jest.mock('@/features/shared/dal/getSystemConfig');
jest.mock('@/features/document-upload-provider/factory');
jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findFirst: jest.fn(),
  },
}));

describe('get-presigned-url route', () => {
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

  const mockInput = {
    fileName: 'test-document.pdf',
    contentType: 'application/pdf',
  };

  const mockStorageProvider = {
    generatePresignedUploadUrl: jest.fn(),
  };

  const mockFactory = {
    buildSource: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (DocumentUploadFactory as jest.Mock).mockImplementation(() => mockFactory);
  });

  it('generates presigned URL successfully for admin user', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: 'provider-123',
    });
    (mockFactory.buildSource as jest.Mock).mockResolvedValue({
      source: mockStorageProvider,
    });
    (mockStorageProvider.generatePresignedUploadUrl as jest.Mock).mockResolvedValue({
      presignedUrl: 'https://example.com/upload',
      fileKey: 'uploads/test-document.pdf',
    });

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);
    const response = await caller.getPresignedUrl(mockInput);

    expect(response).toEqual({
      presignedUrl: 'https://example.com/upload',
      fileKey: 'uploads/test-document.pdf',
      fileName: mockInput.fileName,
    });
    expect(getSystemConfig).toHaveBeenCalled();
    expect(DocumentUploadFactory).toHaveBeenCalledWith({ userId: mockUserId });
    expect(mockFactory.buildSource).toHaveBeenCalledWith('provider-123');
    expect(mockStorageProvider.generatePresignedUploadUrl).toHaveBeenCalledWith(
      mockInput.fileName,
      mockInput.contentType,
      mockUserId
    );
    expect(db.userGroupMembership.findFirst).not.toHaveBeenCalled();
  });

  it('generates presigned URL successfully for group lead user', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: 'provider-123',
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: 'group-1',
      role: UserGroupRole.Lead,
    });
    (mockFactory.buildSource as jest.Mock).mockResolvedValue({
      source: mockStorageProvider,
    });
    (mockStorageProvider.generatePresignedUploadUrl as jest.Mock).mockResolvedValue({
      presignedUrl: 'https://example.com/upload',
      fileKey: 'uploads/test-document.pdf',
    });

    const caller = dataSourcesRouter.createCaller(mockGroupLeadCtx);
    const response = await caller.getPresignedUrl(mockInput);

    expect(response).toEqual({
      presignedUrl: 'https://example.com/upload',
      fileKey: 'uploads/test-document.pdf',
      fileName: mockInput.fileName,
    });
    expect(db.userGroupMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: mockUserId, role: UserGroupRole.Lead },
    });
  });

  it('throws Forbidden error when user is not admin or group lead', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: 'provider-123',
    });
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const caller = dataSourcesRouter.createCaller(mockUserCtx);

    await expect(caller.getPresignedUrl(mockInput)).rejects.toThrow(
      Forbidden('You do not have permission to upload admin data sources')
    );

    expect(mockFactory.buildSource).not.toHaveBeenCalled();
  });

  it('throws BadRequest error when no document upload provider is configured', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: null,
    });

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.getPresignedUrl(mockInput)).rejects.toThrow(
      BadRequest('No document upload provider is configured')
    );

    expect(mockFactory.buildSource).not.toHaveBeenCalled();
  });

  it('rejects empty fileName', async () => {
    const invalidInput = { fileName: '', contentType: 'application/pdf' };

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.getPresignedUrl(invalidInput)).rejects.toThrow();

    expect(mockFactory.buildSource).not.toHaveBeenCalled();
  });

  it('rejects empty contentType', async () => {
    const invalidInput = { fileName: 'test.pdf', contentType: '' };

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.getPresignedUrl(invalidInput)).rejects.toThrow();

    expect(mockFactory.buildSource).not.toHaveBeenCalled();
  });

  it('throws an error if generatePresignedUploadUrl fails', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: 'provider-123',
    });
    (mockFactory.buildSource as jest.Mock).mockResolvedValue({
      source: mockStorageProvider,
    });
    const error = new Error('Storage error');
    (mockStorageProvider.generatePresignedUploadUrl as jest.Mock).mockRejectedValue(error);

    const caller = dataSourcesRouter.createCaller(mockAdminCtx);

    await expect(caller.getPresignedUrl(mockInput)).rejects.toThrow(error.message);
  });
});
