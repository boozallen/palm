import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AWSStorageProvider } from './aws';
import { getConfig } from '@/server/config';
import { generateObjectKey } from '@/features/shared/utils/documentUploadHelpers';
import { DocumentUploadProviderConfig, DocumentUploadProviderType } from '@/features/shared/types/document-upload-provider';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('@/server/config');
jest.mock('@/features/shared/utils/documentUploadHelpers');

const mockS3Client = S3Client as jest.MockedClass<typeof S3Client>;
const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;
const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockGenerateObjectKey = generateObjectKey as jest.MockedFunction<typeof generateObjectKey>;

const mockSend = jest.fn();

describe('AWSStorageProvider', () => {
  const mockProviderConfig: DocumentUploadProviderConfig = {
    providerType: DocumentUploadProviderType.AWS,
    s3Uri: 's3://test-bucket',
    region: 'us-east-1',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    sessionToken: 'test-session-token',
  };

  const mockEnvConfig = {
    documentUploadProvider: {
      userIdSalt: 'test-salt',
      aws: {
        region: 'us-east-2',
        accessKeyId: 'env-access-key',
        secretAccessKey: 'env-secret-key',
        sessionToken: 'env-session-token',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockGetConfig.mockReturnValue(mockEnvConfig as any);
    mockGenerateObjectKey.mockReturnValue('test-file-key');
    
    mockS3Client.mockImplementation(() => ({
      send: mockSend,
    }) as any);
  });

  describe('constructor', () => {
    it('should initialize with provider config values', () => {
      const provider = new AWSStorageProvider(mockProviderConfig);
      
      expect(mockS3Client).toHaveBeenCalledWith({
        region: mockProviderConfig.region,
        credentials: {
          accessKeyId: mockProviderConfig.accessKeyId,
          secretAccessKey: mockProviderConfig.secretAccessKey,
          sessionToken: mockProviderConfig.sessionToken,
        },
      });
    });

    it('should fallback to environment config when provider config is not provided', () => {
      const configWithEmptyCredentials: DocumentUploadProviderConfig = { 
        providerType: DocumentUploadProviderType.AWS,
        s3Uri: 's3://test-bucket',
        accessKeyId: '',
        secretAccessKey: '',
        region: '',
      };

      const provider = new AWSStorageProvider(configWithEmptyCredentials);

      expect(mockS3Client).toHaveBeenCalledWith({
        region: mockEnvConfig.documentUploadProvider.aws.region,
        credentials: {
          accessKeyId: mockEnvConfig.documentUploadProvider.aws.accessKeyId,
          secretAccessKey: mockEnvConfig.documentUploadProvider.aws.secretAccessKey,
          sessionToken: mockEnvConfig.documentUploadProvider.aws.sessionToken,
        },
      });
    });

    it('should set sessionToken to undefined when not provided in config but present in env', () => {
      const configWithoutSessionToken: DocumentUploadProviderConfig = {
        providerType: DocumentUploadProviderType.AWS,
        s3Uri: 's3://test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      };
      
      const provider = new AWSStorageProvider(configWithoutSessionToken);
      
      expect(mockS3Client).toHaveBeenCalledWith({
        region: configWithoutSessionToken.region,
        credentials: {
          accessKeyId: configWithoutSessionToken.accessKeyId,
          secretAccessKey: configWithoutSessionToken.secretAccessKey,
          sessionToken: mockEnvConfig.documentUploadProvider.aws.sessionToken,
        },
      });
    });

    it('should throw an error if s3Uri is not provided', () => {
      const configWithoutS3Uri = {
        providerType: DocumentUploadProviderType.AWS,
        region: 'us-east-1',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        s3Uri: '',
      } as DocumentUploadProviderConfig;
      
      expect(() => new AWSStorageProvider(configWithoutS3Uri)).toThrow(
        'S3 bucket name must be provided in provider config s3Uri'
      );
    });
  });

  describe('generatePresignedUploadUrl', () => {
    let provider: AWSStorageProvider;

    beforeEach(() => {
      provider = new AWSStorageProvider(mockProviderConfig);
    });

    it('should generate presigned upload URL with correct parameters', async () => {
      const mockPresignedUrl = 'https://test-bucket.s3.amazonaws.com/presigned-url';
      mockGetSignedUrl.mockResolvedValue(mockPresignedUrl);

      const result = await provider.generatePresignedUploadUrl(
        'test-file.pdf',
        'application/pdf',
        'user123'
      );

      expect(mockGenerateObjectKey).toHaveBeenCalledWith(
        'user123',
        'test-salt',
        'test-file.pdf'
      );

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object), 
        expect.any(Object), 
        { expiresIn: 3600 }
      );

      expect(result).toEqual({
        presignedUrl: mockPresignedUrl,
        fileKey: 'test-file-key',
      });
    });

    it('should throw an error if userIdSalt is empty', async () => {
      mockGetConfig.mockReturnValue({
        documentUploadProvider: {
          userIdSalt: '',
          aws: mockEnvConfig.documentUploadProvider.aws,
        },
      } as any);

      const provider = new AWSStorageProvider(mockProviderConfig);

      await expect(
        provider.generatePresignedUploadUrl('test-file.pdf', 'application/pdf', 'user123')
      ).rejects.toThrow('Environment variable USER_ID_SALT is required');
    });

    it('should handle errors from AWS SDK', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('AWS SDK error'));

      await expect(
        provider.generatePresignedUploadUrl('test-file.pdf', 'application/pdf', 'user123')
      ).rejects.toThrow('AWS SDK error');
    });
  });

  describe('generateDownloadUrl', () => {
    let provider: AWSStorageProvider;

    beforeEach(() => {
      provider = new AWSStorageProvider(mockProviderConfig);
    });

    it('should generate download URL with correct parameters', async () => {
      const mockDownloadUrl = 'https://test-bucket.s3.amazonaws.com/download-url';
      mockGetSignedUrl.mockResolvedValue(mockDownloadUrl);

      const result = await provider.generateDownloadUrl('test-file-key');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object), 
        expect.any(Object), 
        { expiresIn: 3600 }
      );

      expect(result).toBe(mockDownloadUrl);
    });

    it('should handle errors from AWS SDK', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('AWS SDK error'));

      await expect(provider.generateDownloadUrl('test-file-key')).rejects.toThrow(
        'AWS SDK error'
      );
    });
  });

  describe('fetchFile', () => {
    let provider: AWSStorageProvider;

    beforeEach(() => {
      provider = new AWSStorageProvider(mockProviderConfig);
    });

    it('should fetch file and return Buffer', async () => {
      const mockFileContent = new Uint8Array([1, 2, 3, 4, 5]);
      const mockResponse = {
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(mockFileContent),
        },
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await provider.fetchFile('test-file-key');

      expect(mockSend).toHaveBeenCalledWith(expect.any(Object)); 

      expect(result).toEqual(Buffer.from(mockFileContent));
    });

    it('should throw an error if no file content is found', async () => {
      const mockResponse = {
        Body: null,
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(provider.fetchFile('test-file-key')).rejects.toThrow(
        'No file content found'
      );
    });

    it('should handle errors from AWS SDK', async () => {
      mockSend.mockRejectedValue(new Error('AWS SDK error'));

      await expect(provider.fetchFile('test-file-key')).rejects.toThrow('AWS SDK error');
    });
  });

  describe('deleteFile', () => {
    let provider: AWSStorageProvider;

    beforeEach(() => {
      provider = new AWSStorageProvider(mockProviderConfig);
    });

    it('should delete file with correct parameters', async () => {
      mockSend.mockResolvedValue({});

      await provider.deleteFile('test-file-key');

      expect(mockSend).toHaveBeenCalledWith(expect.any(Object)); 
    });

    it('should handle errors from AWS SDK', async () => {
      mockSend.mockRejectedValue(new Error('AWS SDK error'));

      await expect(provider.deleteFile('test-file-key')).rejects.toThrow('AWS SDK error');
    });
  });
});
