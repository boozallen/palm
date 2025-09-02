import logger from '@/server/logger';
import { AWSStorageProvider } from '@/features/document-upload-provider/sources/aws';
import {
  DocumentUploadProvider,
  DocumentUploadProviderType,
} from '@/features/shared/types/document-upload-provider';
import { getDocumentUploadProvider } from '@/features/shared/dal/document-upload/getDocumentUploadProvider';
import { StorageProvider } from './sources/types';

type BuildResult = {
  source: StorageProvider;
  provider: DocumentUploadProvider;
};

export interface DocumentUploadFactoryConfig {
  userId: string;
}

export class DocumentUploadFactory {
  constructor(protected config: DocumentUploadFactoryConfig) {
    if (!this.config.userId) {
      logger.error('Missing required configuration properties: config.userId');
      throw new Error('Missing required configuration properties');
    }
  }

  async buildSource(providerId: string): Promise<BuildResult> {
    try {
      const provider = await getDocumentUploadProvider(providerId);
      const source = this.buildClient(provider);

      return {
        source,
        provider,
      };
    } catch (cause) {
      const msg = `Error building document upload source for id ${providerId}`;
      logger.error(msg, cause);
      throw new Error(msg, { cause });
    }
  }

  private buildClient(provider: DocumentUploadProvider): StorageProvider {
    switch (provider.config.providerType) {
      case DocumentUploadProviderType.AWS:
        return new AWSStorageProvider(provider.config);
      default:
        logger.error(`Unsupported provider type: ${provider.config.providerType}`);
        throw new Error(`Unsupported provider type: ${provider.config.providerType}`);
    }
  }
}
