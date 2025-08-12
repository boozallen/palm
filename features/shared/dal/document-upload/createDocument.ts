import db from '@/server/db';
import { Document, DocumentUploadStatus } from '@/features/shared/types/document';
import logger from '@/server/logger';

type CreateDocumentInput = {
  userId: string,
  filename: string,
  documentUploadProviderId: string,
};

export default async function createDocument(
  input: CreateDocumentInput
): Promise<Document> {
  try {
    const result = await db.document.create({
      data: {
        userId: input.userId,
        filename: input.filename,
        uploadStatus: DocumentUploadStatus.Pending,
        documentUploadProviderId: input.documentUploadProviderId,
      },
    });

    return {
      id: result.id,
      userId: result.userId,
      filename: result.filename,
      uploadStatus: result.uploadStatus as DocumentUploadStatus,
      createdAt: result.createdAt,
    };
  } catch (error) {
    logger.error(`Error creating document: UserId: ${input.userId}`, error);
    throw new Error('Error creating document');
  }
}
