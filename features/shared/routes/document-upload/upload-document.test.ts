import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import { storage } from '@/server/storage/redis';
import { getDocumentQueue } from '@/features/document-upload-provider/workers/documentQueue';
import createDocument from '@/features/shared/dal/document-upload/createDocument';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import getDocuments from '@/features/shared/dal/document-upload/getDocuments';
import logger from '@/server/logger';

jest.mock('@/features/document-upload-provider/factory', () => ({
  DocumentUploadFactory: jest.fn(),
}));
jest.mock('@/server/storage/redis', () => ({
  storage: { hset: jest.fn() },
}));
jest.mock('@/features/document-upload-provider/workers/documentQueue', () => ({
  getDocumentQueue: jest.fn(),
}));
jest.mock('@/features/shared/dal/document-upload/createDocument', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@/features/shared/dal/document-upload/getDocuments', () => ({
  __esModule: true,
  default: jest.fn(),
}));

global.fetch = jest.fn();

describe('uploadDocument procedure', () => {
  const ctx = { userId: 'user-123', logger } as unknown as ContextType;
  const mockDocumentUploadProviderId = 'c54a871d-bc7c-453e-8e39-5c4ac60cc2c0';
  const input = {
    file: {
      name: 'test.pdf',
      type: 'application/pdf',
      size: 12345,
      data: Buffer.from('dummy').toString('base64'),
    },
    documentUploadProviderId: mockDocumentUploadProviderId,
  };

  const mockBuildSource = jest.fn();
  const MockDocumentUploadFactory = DocumentUploadFactory as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    MockDocumentUploadFactory.mockImplementation(() => ({
      buildSource: mockBuildSource,
    }));

    (getDocuments as jest.Mock).mockResolvedValue([]);
  });

  it('uploads document and queues job (happy path)', async () => {
    // Mock storage provider
    const generatePresignedUploadUrl = jest.fn().mockResolvedValue({
      presignedUrl: 'https://s3-upload-url',
      fileKey: 'file-key-123',
    });
    mockBuildSource.mockResolvedValue({
      source: { generatePresignedUploadUrl },
      provider: { id: 'prov', config: {} },
    });

    // Mock fetch (S3 upload)
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '',
    });

    // Mock DB document creation
    (createDocument as jest.Mock).mockResolvedValue({ id: 'doc-123' });

    // Mock queue
    const add = jest.fn().mockResolvedValue({});
    (getDocumentQueue as jest.Mock).mockReturnValue({ add });

    // Mock Redis
    (storage.hset as jest.Mock).mockResolvedValue(1);

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.uploadDocument(input);

    expect(MockDocumentUploadFactory).toHaveBeenCalledWith({
      userId: ctx.userId,
    });
    expect(mockBuildSource).toHaveBeenCalledWith(mockDocumentUploadProviderId);
    expect(generatePresignedUploadUrl).toHaveBeenCalledWith(
      input.file.name,
      input.file.type,
      ctx.userId
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://s3-upload-url',
      expect.any(Object)
    );
    expect(createDocument).toHaveBeenCalledWith({
      userId: ctx.userId,
      filename: input.file.name,
      documentUploadProviderId: mockDocumentUploadProviderId,
    });
    expect(storage.hset).toHaveBeenCalled();
    expect(add).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        documentId: 'doc-123',
        fileName: input.file.name,
        fileKey: 'file-key-123',
        message: expect.any(String),
        jobId: expect.any(String),
      })
    );
  });

  it('throws if document upload provider is not provided', async () => {
    const inputWithoutProvider = {
      file: input.file,
      documentUploadProviderId: '',
    };

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.uploadDocument(inputWithoutProvider)).rejects.toThrow('Upload requires a valid document upload provider ');
  });

  it('throws if a file with the same name already exists', async () => {
    (getDocuments as jest.Mock).mockResolvedValue([
      { filename: 'test.pdf' },
    ]);

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.uploadDocument(input)).rejects.toThrow(
      /file already exists/i
    );
    expect(getDocuments).toHaveBeenCalledWith({
      userId: ctx.userId,
      documentUploadProviderId: mockDocumentUploadProviderId,
    });
  });

  it('throws if S3 upload fails', async () => {
    const generatePresignedUploadUrl = jest.fn().mockResolvedValue({
      presignedUrl: 'https://s3-upload-url',
      fileKey: 'file-key-123',
    });
    mockBuildSource.mockResolvedValue({
      source: { generatePresignedUploadUrl },
      provider: { id: 'prov', config: {} },
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'S3 error',
    });

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.uploadDocument(input)).rejects.toThrow(/failed to process/i);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('returns jobId null if queue is missing', async () => {
    const generatePresignedUploadUrl = jest.fn().mockResolvedValue({
      presignedUrl: 'https://s3-upload-url',
      fileKey: 'file-key-123',
    });
    mockBuildSource.mockResolvedValue({
      source: { generatePresignedUploadUrl },
      provider: { id: 'prov', config: {} },
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    (createDocument as jest.Mock).mockResolvedValue({ id: 'doc-123' });
    (getDocumentQueue as jest.Mock).mockReturnValue(null);

    const caller = sharedRouter.createCaller(ctx);
    const result = await caller.uploadDocument(input);

    expect(result.jobId).toBeNull();
    expect(result.success).toBe(true);
  });
});
