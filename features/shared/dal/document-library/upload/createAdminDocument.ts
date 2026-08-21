import db from '@/server/db';
import { Document, DocumentUploadStatus } from '@/features/shared/types/document';
import logger from '@/server/logger';

type CreateAdminDocumentInput = {
  userId: string;
  filename: string;
  documentUploadProviderId: string;
};

export default async function createAdminDocument(
  input: CreateAdminDocumentInput
): Promise<Document> {
  try {
    const result = await db.document.create({
      data: {
        userId: input.userId,
        filename: input.filename,
        uploadStatus: DocumentUploadStatus.Pending,
        documentUploadProviderId: input.documentUploadProviderId,
        adminCreated: true,
      },
    });

    return {
      id: result.id,
      userId: result.userId,
      filename: result.filename,
      uploadStatus: result.uploadStatus as DocumentUploadStatus,
      createdAt: result.createdAt,
      text: result.text ?? undefined,
      adminCreated: result.adminCreated,
    };
  } catch (error) {
    logger.error(`Error creating admin document: UserId: ${input.userId}`, error);
    throw new Error('Error creating admin document');
  }
}
