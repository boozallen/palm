import { DocumentUploadProvider, documentUploadProviderConfigSchema } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

export type CreateDocumentUploadProviderInput = Omit<DocumentUploadProvider, 'id'>;

export default async function createDocumentUploadProvider(
  input: CreateDocumentUploadProviderInput
): Promise<DocumentUploadProvider> {
  try {
    const result = await db.documentUploadProvider.create({
      data: {
        type: input.config.providerType,
        ...input,
      },
    });

    return {
      id: result.id,
      label: result.label,
      config: documentUploadProviderConfigSchema.parse(result.config),
    };
  } catch (error) {
    logger.error('Error creating document upload provider', error);
    throw new Error('Error creating document upload provider');
  }
}
