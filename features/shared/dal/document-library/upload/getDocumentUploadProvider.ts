import db from '@/server/db';
import logger from '@/server/logger';
import {
  DocumentUploadProviderType,
  DocumentUploadProvider,
  documentUploadProviderConfigSchema,
} from '@/features/shared/types/document-upload-provider';

export async function getDocumentUploadProvider(
  providerId: string
): Promise<DocumentUploadProvider> {
  try {
    const dbProvider = await db.documentUploadProvider.findUnique({
      where: { id: providerId },
    });

    if (!dbProvider) {
      throw new Error('Document upload provider not found');
    }

    const providerType = dbProvider.type;
    
    if (!Object.values(DocumentUploadProviderType).includes(providerType)) {
      throw new Error(`Unsupported provider type: ${providerType}`);
    }

    const config = documentUploadProviderConfigSchema.parse(dbProvider.config);

    return {
      id: dbProvider.id,
      label: dbProvider.label,

      config,
    };
  } catch (error) {
    logger.error('Error getting document upload provider', error);
    throw new Error('Error getting document upload provider');
  }
}
