import updateDocumentUploadProvider, {
  UpdateDocumentUploadProviderInput,
} from './updateDocumentUploadProvider';
import db from '@/server/db';
import logger from '@/server/logger';
import { DocumentUploadProviderType } from '@/features/shared/types/document-upload-provider';

jest.mock('@/server/db', () => ({
  documentUploadProvider: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

const mockDb = db.documentUploadProvider as jest.Mocked<typeof db.documentUploadProvider>;

const existingConfig = {
  providerType: DocumentUploadProviderType.AWS,
  accessKeyId: 'EXISTING_KEY',
  secretAccessKey: 'EXISTING_SECRET',
  sessionToken: 'EXISTING_TOKEN',
  region: 'us-east-1',
  s3Uri: 's3://bucket/key',
};

const existingProvider = {
  id: 'uuid-123',
  label: 'Original Label',
  type: DocumentUploadProviderType.AWS,
  config: existingConfig,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('updateDocumentUploadProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates label and s3Uri and returns the updated provider', async () => {
    const input: UpdateDocumentUploadProviderInput = {
      id: 'uuid-123',
      label: 'New Label',
      config: {
        providerType: DocumentUploadProviderType.AWS,
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        region: '',
        s3Uri: 's3://new-bucket/key',
      },
    };

    const updatedProvider = {
      ...existingProvider,
      label: input.label,
      config: {
        ...existingConfig,
        s3Uri: 's3://new-bucket/key',
      },
    };

    mockDb.findUnique.mockResolvedValueOnce(existingProvider);
    mockDb.update.mockResolvedValueOnce(updatedProvider);

    const result = await updateDocumentUploadProvider(input);

    expect(mockDb.findUnique).toHaveBeenCalledWith({ where: { id: input.id } });
    expect(mockDb.update).toHaveBeenCalledWith({
      where: { id: input.id },
      data: expect.objectContaining({
        label: 'New Label',
        config: expect.objectContaining({ s3Uri: 's3://new-bucket/key' }),
      }),
    });
    expect(result.label).toBe('New Label');
  });

  it('keeps existing credentials when new credential fields are empty', async () => {
    const input: UpdateDocumentUploadProviderInput = {
      id: 'uuid-123',
      label: 'Updated Label',
      config: {
        providerType: DocumentUploadProviderType.AWS,
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        region: '',
        s3Uri: 's3://bucket/key',
      },
    };

    mockDb.findUnique.mockResolvedValueOnce(existingProvider);
    mockDb.update.mockResolvedValueOnce({ ...existingProvider, label: input.label });

    await updateDocumentUploadProvider(input);

    const updateCall = mockDb.update.mock.calls[0][0];
    const savedConfig = updateCall.data.config as typeof existingConfig;
    expect(savedConfig.accessKeyId).toBe('EXISTING_KEY');
    expect(savedConfig.secretAccessKey).toBe('EXISTING_SECRET');
    expect(savedConfig.sessionToken).toBe('EXISTING_TOKEN');
    expect(savedConfig.region).toBe('us-east-1');
  });

  it('replaces credentials when new values are provided', async () => {
    const input: UpdateDocumentUploadProviderInput = {
      id: 'uuid-123',
      label: 'Updated Label',
      config: {
        providerType: DocumentUploadProviderType.AWS,
        accessKeyId: 'NEW_KEY',
        secretAccessKey: 'NEW_SECRET',
        sessionToken: 'NEW_TOKEN',
        region: 'eu-west-1',
        s3Uri: 's3://bucket/key',
      },
    };

    mockDb.findUnique.mockResolvedValueOnce(existingProvider);
    mockDb.update.mockResolvedValueOnce({ ...existingProvider, config: input.config });

    await updateDocumentUploadProvider(input);

    const updateCall = mockDb.update.mock.calls[0][0];
    const savedConfig = updateCall.data.config as typeof existingConfig;
    expect(savedConfig.accessKeyId).toBe('NEW_KEY');
    expect(savedConfig.secretAccessKey).toBe('NEW_SECRET');
    expect(savedConfig.sessionToken).toBe('NEW_TOKEN');
    expect(savedConfig.region).toBe('eu-west-1');
  });

  it('throws when provider is not found', async () => {
    mockDb.findUnique.mockResolvedValueOnce(null);

    await expect(
      updateDocumentUploadProvider({
        id: 'missing-id',
        label: 'Label',
        config: {
          providerType: DocumentUploadProviderType.AWS,
          accessKeyId: '',
          secretAccessKey: '',
          region: '',
          s3Uri: 's3://bucket/key',
        },
      })
    ).rejects.toThrow('Error updating document upload provider');
  });

  it('logs and throws on db error', async () => {
    const error = new Error('DB error');
    mockDb.findUnique.mockRejectedValueOnce(error);

    await expect(
      updateDocumentUploadProvider({
        id: 'uuid-123',
        label: 'Label',
        config: {
          providerType: DocumentUploadProviderType.AWS,
          accessKeyId: '',
          secretAccessKey: '',
          region: '',
          s3Uri: 's3://bucket/key',
        },
      })
    ).rejects.toThrow('Error updating document upload provider');

    expect(logger.error).toHaveBeenCalledWith('Error updating document upload provider', error);
  });
});
