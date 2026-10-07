import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import { UserRole } from '@/features/shared/types/user';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/document-upload-provider/factory');
jest.mock('@/features/shared/dal/getSystemConfig');

describe('getTemplatePresignedUrl route', () => {
  const mockPresignedUrl = 'https://s3.amazonaws.com/bucket/file?signature=xyz';
  const mockFileKey = 'document-upload/users/abc123/template.pptx';
  const mockProviderId = 'c54a871d-bc7c-453e-8e39-5c4ac60cc2c0';

  const mockGeneratePresignedUploadUrl = jest.fn();
  const mockBuildSource = jest.fn();

  const ctx = {
    userRole: UserRole.Admin,
    userId: '97cc1d48-03df-4c18-9456-917c1ac78c77',
    logger: { info: jest.fn(), warn: jest.fn() },
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (getSystemConfig as jest.Mock).mockResolvedValue({
      documentLibraryDocumentUploadProviderId: mockProviderId,
    });
    mockGeneratePresignedUploadUrl.mockResolvedValue({
      presignedUrl: mockPresignedUrl,
      fileKey: mockFileKey,
    });
    mockBuildSource.mockResolvedValue({ source: { generatePresignedUploadUrl: mockGeneratePresignedUploadUrl } });
    (DocumentUploadFactory as jest.Mock).mockImplementation(() => ({ buildSource: mockBuildSource }));
  });

  it('returns presigned URL and fileKey for admin', async () => {
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.getTemplatePresignedUrl({
      fileName: 'template.pptx',
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });

    expect(result).toEqual({ presignedUrl: mockPresignedUrl, fileKey: mockFileKey });
    expect(DocumentUploadFactory).toHaveBeenCalledWith({ userId: ctx.userId });
    expect(mockBuildSource).toHaveBeenCalledWith(mockProviderId);
    expect(mockGeneratePresignedUploadUrl).toHaveBeenCalledWith(
      'template.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ctx.userId,
    );
  });

  it('throws Forbidden when user is not Admin', async () => {
    const nonAdminCtx = { ...ctx, userRole: UserRole.User } as unknown as ContextType;
    const caller = settingsRouter.createCaller(nonAdminCtx);

    await expect(
      caller.getTemplatePresignedUrl({ fileName: 'template.pptx', contentType: 'application/octet-stream' }),
    ).rejects.toThrow(/do not have permission/i);

    expect(mockGeneratePresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('throws BadRequest when no upload provider is configured', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({ documentLibraryDocumentUploadProviderId: null });
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getTemplatePresignedUrl({ fileName: 'template.pptx', contentType: 'application/octet-stream' }),
    ).rejects.toThrow(/No document upload provider/i);
  });

  it('throws when S3 presigned URL generation fails', async () => {
    mockGeneratePresignedUploadUrl.mockRejectedValue(new Error('S3 error'));
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getTemplatePresignedUrl({ fileName: 'template.pptx', contentType: 'application/octet-stream' }),
    ).rejects.toThrow('S3 error');
  });
});
