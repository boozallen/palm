import { BadRequest } from '@/features/shared/errors/routeErrors';
import { KbProviderConfig, SanitizedKbProviderConfig } from '@/features/shared/types';

/**
 * Utility function to sanitize the KB Provider Config
 *
 * @param config The KB Provider Config
 */
export default function sanitizeKbProviderConfig(config: KbProviderConfig): SanitizedKbProviderConfig {
  if ('apiKey' in config) {
    return { apiEndpoint: config.apiEndpoint };
  } else if ('accessKeyId' in config) {
    return {
      region: config.region,
      dataSourceId: config.dataSourceId,
      personalDocumentLibraryKnowledgeBaseId: config.personalDocumentLibraryKnowledgeBaseId,
      s3BucketUri: config.s3BucketUri,
    };
  } else {
    throw BadRequest('There was a problem adding the knowledge base provider');
  }
};
