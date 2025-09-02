import { DocumentUploadProvider, documentUploadProviderConfigSchema } from '@/features/shared/types/document-upload-provider';
import db from '@/server/db';
import logger from '@/server/logger';

export default async function getDocumentUploadProviders(): Promise<DocumentUploadProvider[]> {
  let results = null;

  try {
    results = await db.documentUploadProvider.findMany({
      where: {
        deletedAt: null,
      },
    });

    const providers: DocumentUploadProvider[] = results
      .map((provider) => {
        try {
          return {
            id: provider.id,
            label: provider.label,
            config: documentUploadProviderConfigSchema.parse(provider.config),
          };
        } catch (configError) {
          logger.warn(`Invalid config for document upload provider ${provider.id} (${provider.label}). Skipping.`, configError);
          return null;
        }
      })
      .filter((provider): provider is DocumentUploadProvider => provider !== null);

    return providers;
  } catch (error) {
    logger.error('Error fetching document upload providers', error);
    throw new Error('There was a problem fetching document upload providers');
  }
}

