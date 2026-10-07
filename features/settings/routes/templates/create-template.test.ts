import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import { UserRole } from '@/features/shared/types/user';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import createTemplateDal from '@/features/settings/dal/templates/createTemplate';
import { createAuditor } from '@/server/auditor';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/document-upload-provider/factory');
jest.mock('@/features/shared/dal/getSystemConfig');
jest.mock('@/features/settings/dal/templates/createTemplate');
jest.mock('@/server/auditor');

describe('createTemplate route', () => {
  const mockProviderId = 'c54a871d-bc7c-453e-8e39-5c4ac60cc2c0';
  const mockFileKey = 'document-upload/users/abc123/template.pptx';
  const mockFileBuffer = Buffer.from('fake pptx bytes');
  const mockTemplate = {
    id: '00000000-0000-0000-0000-000000000001',
    filename: 'template.pptx',
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
  };

  const mockFetchFile = jest.fn();
  const mockDeleteFile = jest.fn();
  const mockBuildSource = jest.fn();
  const mockCreateAuditRecord = jest.fn();

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
    mockFetchFile.mockResolvedValue(mockFileBuffer);
    mockDeleteFile.mockResolvedValue(undefined);
    mockBuildSource.mockResolvedValue({
      source: { fetchFile: mockFetchFile, deleteFile: mockDeleteFile },
    });
    (DocumentUploadFactory as jest.Mock).mockImplementation(() => ({ buildSource: mockBuildSource }));
    (createTemplateDal as jest.Mock).mockResolvedValue(mockTemplate);
    (createAuditor as jest.Mock).mockReturnValue({ createAuditRecord: mockCreateAuditRecord });
  });

  it('fetches from S3, saves to DB, deletes from S3, and returns template', async () => {
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.createTemplate({ fileName: 'Template.pptx', fileKey: mockFileKey });

    expect(mockFetchFile).toHaveBeenCalledWith(mockFileKey);
    expect(createTemplateDal).toHaveBeenCalledWith({
      filename: 'template.pptx',
      fileData: mockFileBuffer.toString('base64'),
    });
    expect(mockDeleteFile).toHaveBeenCalledWith(mockFileKey);
    expect(mockCreateAuditRecord).toHaveBeenCalled();
    expect(result).toEqual(mockTemplate);
  });

  it('lowercases the filename', async () => {
    const caller = settingsRouter.createCaller(ctx);
    await caller.createTemplate({ fileName: 'MY-TEMPLATE.PPTX', fileKey: mockFileKey });

    expect(createTemplateDal).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'my-template.pptx' }),
    );
  });

  it('throws Forbidden when user is not Admin', async () => {
    const nonAdminCtx = { ...ctx, userRole: UserRole.User } as unknown as ContextType;
    const caller = settingsRouter.createCaller(nonAdminCtx);

    await expect(
      caller.createTemplate({ fileName: 'template.pptx', fileKey: mockFileKey }),
    ).rejects.toThrow(/do not have permission/i);

    expect(mockFetchFile).not.toHaveBeenCalled();
  });

  it('throws BadRequest when no upload provider is configured', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({ documentLibraryDocumentUploadProviderId: null });
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.createTemplate({ fileName: 'template.pptx', fileKey: mockFileKey }),
    ).rejects.toThrow(/No document upload provider/i);
  });

  it('throws when S3 fetch fails', async () => {
    mockFetchFile.mockRejectedValue(new Error('S3 fetch error'));
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.createTemplate({ fileName: 'template.pptx', fileKey: mockFileKey }),
    ).rejects.toThrow('S3 fetch error');

    expect(createTemplateDal).not.toHaveBeenCalled();
  });

  it('throws when DAL fails', async () => {
    (createTemplateDal as jest.Mock).mockRejectedValue(new Error('DB error'));
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.createTemplate({ fileName: 'template.pptx', fileKey: mockFileKey }),
    ).rejects.toThrow('DB error');
  });

  it('logs a warning but does not throw when S3 cleanup fails', async () => {
    mockDeleteFile.mockRejectedValue(new Error('S3 delete error'));
    const caller = settingsRouter.createCaller(ctx);

    const result = await caller.createTemplate({ fileName: 'template.pptx', fileKey: mockFileKey });

    expect(result).toEqual(mockTemplate);
    expect((ctx.logger.warn as jest.Mock)).toHaveBeenCalledWith(
      expect.stringContaining(mockFileKey),
    );
  });
});
