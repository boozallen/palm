import { DocumentUploadFactory } from './factory';
import {
  DocumentUploadProviderType,
  DocumentUploadProvider,
} from '@/features/shared/types/document-upload-provider';

jest.mock('./sources/aws', () => {
  return {
    AWSStorageProvider: jest.fn().mockImplementation((config) => {
      return { __mocked: true, config };
    }),
  };
});

const { AWSStorageProvider } = require('./sources/aws');

describe('createStorageProvider', () => {
  const validAwsConfig = {
    providerType: DocumentUploadProviderType.AWS,
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    region: 'us-east-1',
    s3Uri: 's3://test-bucket',
  };

  const validProvider: DocumentUploadProvider = {
    id: 'provider-1',
    label: 'Test AWS Provider',
    config: validAwsConfig,
  };

  it('returns an instance of AWSStorageProvider for AWS provider type', () => {
    const factory = new DocumentUploadFactory({ userId: 'test-user' });
    // @ts-ignore: Accessing private method for test purposes
    const provider = factory['buildClient'](validProvider);
    expect(AWSStorageProvider).toHaveBeenCalledWith(validAwsConfig);
    expect(provider).toEqual(
      expect.objectContaining({ __mocked: true, config: validAwsConfig })
    );
  });

  it('throws an error for unsupported provider type', () => {
    const factory = new DocumentUploadFactory({ userId: 'test-user' });
    const invalidProvider: DocumentUploadProvider = {
      id: 'provider-2',
      label: 'Invalid Provider',
      config: {
        providerType: 999 as DocumentUploadProviderType,
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
        region: 'dummy',
        s3Uri: 'dummy',
      },
    };
    // @ts-ignore: Accessing private method for test purposes
    expect(() => factory['buildClient'](invalidProvider)).toThrow(
      'Unsupported provider type: 999'
    );
  });
});
