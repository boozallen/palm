import db from '@/server/db';
import logger from '@/server/logger';

import { Document, DocumentUploadStatus } from '@/features/shared/types/document';

export default async function getDocument(documentId: string): Promise<Document | null> {
  try {
    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return null;
    }

    return {
      id: document.id,
      userId: document.userId,
      filename: document.filename,
      createdAt: document.createdAt,
      uploadStatus: document.uploadStatus as DocumentUploadStatus,
    };
  } catch (error) {
    logger.error('Error getting document', error);
    throw new Error('Error getting document');
  }
}
