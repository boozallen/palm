import { DocumentUploadProvider, documentUploadProviderConfigSchema } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

export default async function deleteDocumentUploadProvider(providerId: string): Promise<DocumentUploadProvider> {
  return await db.$transaction(async (tx) => {
    let provider;

    try {
      provider = await tx.documentUploadProvider.findUnique({
        where: { id: providerId, deletedAt: null },
      });
    } catch (error) {
      logger.error(`There was a problem fetching the provider: ${providerId}`, error);
      throw new Error('There was a problem deleting the provider.');
    }

    if (!provider) {
      logger.error(`Unable to find provider with id: ${providerId}`);
      throw new Error('The request document upload provider was not found.');
    }

    try {
      await tx.documentUploadProvider.update({
        where: { id: providerId },
        data: { deletedAt: new Date() },
      });

      const systemConfigRecord = await tx.systemConfig.findUnique({
        where: {
          documentLibraryDocumentUploadProviderId: provider.id,
        },
      });

      if (systemConfigRecord) {
        await tx.systemConfig.update({
          where: {
            documentLibraryDocumentUploadProviderId: provider.id,
          },
          data: {
            documentLibraryDocumentUploadProviderId: null,
          },
        });
      }

      await tx.document.deleteMany({
        where: { documentUploadProviderId: providerId },
      });
    } catch (error) {
      logger.error(`There was a problem deleting the provider: ${providerId}`, error);
      throw new Error('There was a problem deleting the provider.');
    }

    return {
      id: provider.id,
      label: provider.label,
      config: documentUploadProviderConfigSchema.parse(provider.config),
    };
  });
}
