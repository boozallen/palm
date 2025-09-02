import db from '@/server/db';
import logger from '@/server/logger';

import { Document, DocumentUploadStatus } from '@/features/shared/types/document';

type GetDocumentsInput = {
  userId: string,
  documentUploadProviderId: string,
};

export default async function getDocuments(
  input: GetDocumentsInput
): Promise<Document[]> {
  try {
    const results = await db.document.findMany({
      where: {
        userId: input.userId,
        documentUploadProviderId: input.documentUploadProviderId,
      },
    });

    return results.map(document => ({
      id: document.id,
      userId: document.userId,
      filename: document.filename,
      createdAt: document.createdAt,
      uploadStatus: document.uploadStatus as DocumentUploadStatus,
    }));
  } catch (error) {
    logger.error('Error getting documents', error);
    throw new Error('Error getting documents');
  }
}
