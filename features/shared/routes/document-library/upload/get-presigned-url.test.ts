import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/document-upload-provider/factory');

describe('get-presigned-url route', () => {
  const mockDocumentUploadProviderId = 'c54a871d-bc7c-453e-8e39-5c4ac60cc2c0';
  const mockPresignedUrl = 'https://s3.amazonaws.com/bucket/file?signature=xyz';
  const mockFileKey = 'uploads/user123/file.pdf';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates presigned URL for file upload', async () => {
    const userId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
    const mockGeneratePresignedUploadUrl = jest.fn().mockResolvedValue({
      presignedUrl: mockPresignedUrl,
      fileKey: mockFileKey,
    });

    const mockBuildSource = jest.fn().mockResolvedValue({
      source: {
        generatePresignedUploadUrl: mockGeneratePresignedUploadUrl,
      },
      provider: {},
    });

    (DocumentUploadFactory as jest.Mock).mockImplementation(() => ({
      buildSource: mockBuildSource,
    }));

    const ctx = { 
      userId,
      logger: {
        debug: jest.fn(),
      },
    } as unknown as ContextType;
    
    const caller = sharedRouter.createCaller(ctx);

    const result = await caller.getPresignedUrl({
      fileName: 'test.pdf',
      contentType: 'application/pdf',
      documentUploadProviderId: mockDocumentUploadProviderId,
    });

    expect(result).toEqual({
      presignedUrl: mockPresignedUrl,
      fileKey: mockFileKey,
      fileName: 'test.pdf',
    });

    expect(DocumentUploadFactory).toHaveBeenCalledWith({ userId });
    expect(mockBuildSource).toHaveBeenCalledWith(mockDocumentUploadProviderId);
    expect(mockGeneratePresignedUploadUrl).toHaveBeenCalledWith(
      'test.pdf',
      'application/pdf',
      userId
    );
  });

  it('throws error when factory fails', async () => {
    const userId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
    const mockError = new Error('Failed to build source');

    const mockBuildSource = jest.fn().mockRejectedValue(mockError);

    (DocumentUploadFactory as jest.Mock).mockImplementation(() => ({
      buildSource: mockBuildSource,
    }));

    const ctx = {
      userId,
      logger: {
        debug: jest.fn(),
      },
    } as unknown as ContextType;
    
    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.getPresignedUrl({
        fileName: 'test.pdf',
        contentType: 'application/pdf',
        documentUploadProviderId: mockDocumentUploadProviderId,
      })
    ).rejects.toThrow();
  });

  it('throws error when generatePresignedUploadUrl fails', async () => {
    const userId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
    const mockError = new Error('S3 error');

    const mockGeneratePresignedUploadUrl = jest.fn().mockRejectedValue(mockError);

    const mockBuildSource = jest.fn().mockResolvedValue({
      source: {
        generatePresignedUploadUrl: mockGeneratePresignedUploadUrl,
      },
      provider: {},
    });

    (DocumentUploadFactory as jest.Mock).mockImplementation(() => ({
      buildSource: mockBuildSource,
    }));

    const ctx = {
      userId,
      logger: {
        debug: jest.fn(),
      },
    } as unknown as ContextType;
    
    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.getPresignedUrl({
        fileName: 'test.pdf',
        contentType: 'application/pdf',
        documentUploadProviderId: mockDocumentUploadProviderId,
      })
    ).rejects.toThrow();
  });
});