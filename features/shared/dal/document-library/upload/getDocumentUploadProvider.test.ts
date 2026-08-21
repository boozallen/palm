import { getDocumentUploadProvider } from './getDocumentUploadProvider';
import db from '@/server/db';
import logger from '@/server/logger';
import {
  DocumentUploadProviderType,
} from '@/features/shared/types/document-upload-provider';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    documentUploadProvider: {
      findUnique: jest.fn(),
    },
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

import { documentUploadProviderConfigSchema } from '@/features/shared/types/document-upload-provider';
const mockParse = documentUploadProviderConfigSchema.parse as jest.Mock;

describe('getDocumentUploadProvider', () => {
  const mockFindUnique = db.documentUploadProvider.findUnique as jest.Mock;
  const mockLoggerError = logger.error as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns provider data for AWS type', async () => {
    const providerId = 'aws-123';
    const storedConfig = {
      accessKeyId: 'AKIA_TEST',
      secretAccessKey: 'SECRET_TEST',
      region: 'us-east-1',
      s3Uri: 's3://test-bucket',
    };
    const expectedConfig = {
      providerType: DocumentUploadProviderType.AWS,
      ...storedConfig,
    };
    
    const dbProvider = {
      id: providerId,
      label: 'AWS Provider',
      type: DocumentUploadProviderType.AWS,
      config: storedConfig,
    };
    
    mockFindUnique.mockResolvedValueOnce(dbProvider);
    mockParse.mockReturnValueOnce(expectedConfig); 

    const result = await getDocumentUploadProvider(providerId);

    expect(result).toEqual({
      id: providerId,
      label: 'AWS Provider',
      config: expectedConfig,
    });
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: providerId } });
    expect(mockParse).toHaveBeenCalledWith(storedConfig);
  });

  it('throws if provider not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(getDocumentUploadProvider('missing-id')).rejects.toThrow('Error getting document upload provider');
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Error getting document upload provider',
      expect.any(Error)
    );
  });

  it('throws if provider type is unsupported', async () => {
    const providerId = 'unsupported-123';
    const dbProvider = {
      id: providerId,
      label: 'Other Provider',
      type: 999, 
      config: {},
    };
    mockFindUnique.mockResolvedValueOnce(dbProvider);

    await expect(getDocumentUploadProvider(providerId)).rejects.toThrow('Error getting document upload provider');
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Error getting document upload provider',
      expect.any(Error)
    );
  });

  it('handles null config gracefully', async () => {
    const providerId = 'null-config-123';
    const expectedConfig = {
      providerType: DocumentUploadProviderType.AWS,
    };
    
    const dbProvider = {
      id: providerId,
      label: 'AWS Provider',
      type: DocumentUploadProviderType.AWS,
      config: null,
    };
    
    mockFindUnique.mockResolvedValueOnce(dbProvider);
    mockParse.mockReturnValueOnce(expectedConfig); 

    const result = await getDocumentUploadProvider(providerId);

    expect(result).toEqual({
      id: providerId,
      label: 'AWS Provider',
      config: expectedConfig,
    });
    expect(mockParse).toHaveBeenCalledWith(null);
  });

  it('logs and throws on db error', async () => {
    const error = new Error('DB error');
    mockFindUnique.mockRejectedValueOnce(error);

    await expect(getDocumentUploadProvider('any-id')).rejects.toThrow('Error getting document upload provider');
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Error getting document upload provider',
      error
    );
  });
});
