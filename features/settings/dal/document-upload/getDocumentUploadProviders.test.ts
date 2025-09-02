import db from '@/server/db';
import logger from '@/server/logger';
import getDocumentUploadProviders from './getDocumentUploadProviders';
import { documentUploadProviderConfigSchema, DocumentUploadProviderType } from '@/features/shared/types/document-upload-provider';

jest.mock('@/server/db', () => ({
  documentUploadProvider: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/features/shared/types/document-upload-provider', () => {
  const actual = jest.requireActual('@/features/shared/types/document-upload-provider');
  return {
    ...actual,
    documentUploadProviderConfigSchema: {
      parse: jest.fn(),
    },
  };
});

describe('getDocumentUploadProviders', () => {
  const mockProviderDb = {
    id: 'provider-id-1',
    label: 'Provider 1',
    providerType: DocumentUploadProviderType.AWS,
    config: {
      providerType: DocumentUploadProviderType.AWS,
      accessKeyId: 'access-key-id',
      secretAccessKey: 'secret-access-key',
      sessionToken: 'session-token',
      region: 'region',
      s3Ur: 'S3 URI',
    },
    deletedAt: null,
  };

  const mockParsedConfig = {
    providerType: DocumentUploadProviderType.AWS,
    accessKeyId: 'access-key-id',
    secretAccessKey: 'secret-access-key',
    sessionToken: 'session-token',
    region: 'region',
    s3Ur: 'S3 URI',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch and map all document upload providers', async () => {
    (db.documentUploadProvider.findMany as jest.Mock).mockResolvedValue([mockProviderDb]);
    (documentUploadProviderConfigSchema.parse as jest.Mock).mockReturnValue(mockParsedConfig);

    const result = await getDocumentUploadProviders();

    expect(db.documentUploadProvider.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });

    expect(documentUploadProviderConfigSchema.parse).toHaveBeenCalledWith(mockProviderDb.config);

    expect(result).toEqual([
      {
        id: mockProviderDb.id,
        label: mockProviderDb.label,
        config: {
          ...mockProviderDb.config,
        },
      },
    ]);

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw an error and log if db.findMany fails', async () => {
    const dbError = new Error('DB error');
    (db.documentUploadProvider.findMany as jest.Mock).mockRejectedValue(dbError);

    await expect(getDocumentUploadProviders()).rejects.toThrow('There was a problem fetching document upload providers');

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching document upload providers',
      dbError
    );
  });

  it('should skip providers with invalid config and log warning', async () => {
    (db.documentUploadProvider.findMany as jest.Mock).mockResolvedValue([mockProviderDb]);
    const parseError = new Error('Config parse error');
    (documentUploadProviderConfigSchema.parse as jest.Mock).mockImplementation(() => { throw parseError; });

    const result = await getDocumentUploadProviders();

    expect(result).toEqual([]);

    expect(logger.warn).toHaveBeenCalledWith(
      `Invalid config for document upload provider ${mockProviderDb.id} (${mockProviderDb.label}). Skipping.`,
      parseError
    );
  });

  it('should return valid providers and skip invalid ones', async () => {
    const validProvider = { ...mockProviderDb, id: 'valid-provider' };
    const invalidProvider = { ...mockProviderDb, id: 'invalid-provider' };
    
    (db.documentUploadProvider.findMany as jest.Mock).mockResolvedValue([validProvider, invalidProvider]);
    
    const parseError = new Error('Config parse error');
    (documentUploadProviderConfigSchema.parse as jest.Mock)
      .mockReturnValueOnce(mockParsedConfig) // Valid for first provider
      .mockImplementationOnce(() => { throw parseError; }); // Invalid for second provider

    const result = await getDocumentUploadProviders();

    expect(result).toEqual([
      {
        id: validProvider.id,
        label: validProvider.label,
        config: mockParsedConfig,
      },
    ]);

    expect(logger.warn).toHaveBeenCalledWith(
      `Invalid config for document upload provider ${invalidProvider.id} (${invalidProvider.label}). Skipping.`,
      parseError
    );
  });
});
