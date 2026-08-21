import createDocumentUploadProvider, {
  CreateDocumentUploadProviderInput,
} from './createDocumentUploadProvider';
import db from '@/server/db';
import logger from '@/server/logger';
import { DocumentUploadProviderType } from '@/features/shared/types/document-upload-provider';

jest.mock('@/server/db', () => ({
  documentUploadProvider: {
    create: jest.fn(),
  },
}));

const mockDb = db.documentUploadProvider as jest.Mocked<typeof db.documentUploadProvider>;

describe('createDocumentUploadProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates and returns a document upload provider with parsed config', async () => {
    const input: CreateDocumentUploadProviderInput = {
      label: 'Test Provider',
      config: {
        providerType: DocumentUploadProviderType.AWS,
        accessKeyId: 'AKIA...',
        secretAccessKey: 'SECRET',
        region: 'us-east-1',
        s3Uri: 's3://bucket/key',
      },
    };

    const fakeResult = {
      id: 'uuid-123',
      label: input.label,
      type: input.config.providerType,
      config: input.config,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    mockDb.create.mockResolvedValueOnce(fakeResult);

    const result = await createDocumentUploadProvider(input);
    expect(result).toEqual({
      id: fakeResult.id,
      label: fakeResult.label,
      config: input.config, // zod parse returns the same object for valid input
    });
    expect(mockDb.create).toHaveBeenCalledWith({
      data: {
        type: input.config.providerType,
        ...input,
      },
    });
  });

  it('logs and throws on db error', async () => {
    const input: CreateDocumentUploadProviderInput = {
      label: 'Test Provider',
      config: {
        providerType: DocumentUploadProviderType.AWS,
        accessKeyId: 'AKIA...',
        secretAccessKey: 'SECRET',
        region: 'us-east-1',
        s3Uri: 's3://bucket/key',
      },
    };

    const error = new Error('DB error');
    mockDb.create.mockRejectedValueOnce(error);

    await expect(createDocumentUploadProvider(input)).rejects.toThrow('Error creating document upload provider');
    expect(logger.error).toHaveBeenCalledWith('Error creating document upload provider', error);
  });
});
