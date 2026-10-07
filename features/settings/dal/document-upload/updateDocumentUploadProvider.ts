import { DocumentUploadProvider, documentUploadProviderConfigSchema } from '@/features/shared/types';
import { DocumentUploadProviderConfig } from '@/features/shared/types/document-upload-provider';
import db from '@/server/db';
import logger from '@/server/logger';

export type UpdateDocumentUploadProviderInput = {
  id: string;
  label: string;
  config: DocumentUploadProviderConfig;
};

export default async function updateDocumentUploadProvider(
  input: UpdateDocumentUploadProviderInput
): Promise<DocumentUploadProvider> {
  try {
    const existing = await db.documentUploadProvider.findUnique({
      where: { id: input.id },
    });

    if (!existing) {
      throw new Error('Document upload provider not found');
    }

    const existingConfig = documentUploadProviderConfigSchema.parse(existing.config);

    // Merge: only override credential/optional fields if new values are provided,
    // keeping existing values when the user chose not to replace them
    const mergedConfig: DocumentUploadProviderConfig = {
      ...existingConfig,
      s3Uri: input.config.s3Uri,
      region: input.config.region || existingConfig.region,
      accessKeyId: input.config.accessKeyId || existingConfig.accessKeyId,
      secretAccessKey: input.config.secretAccessKey || existingConfig.secretAccessKey,
      ...(input.config.sessionToken
        ? { sessionToken: input.config.sessionToken }
        : { sessionToken: existingConfig.sessionToken }),
    };

    const result = await db.documentUploadProvider.update({
      where: { id: input.id },
      data: {
        label: input.label,
        type: mergedConfig.providerType,
        config: mergedConfig,
      },
    });

    return {
      id: result.id,
      label: result.label,
      config: documentUploadProviderConfigSchema.parse(result.config),
    };
  } catch (error) {
    logger.error('Error updating document upload provider', error);
    throw new Error('Error updating document upload provider');
  }
}
