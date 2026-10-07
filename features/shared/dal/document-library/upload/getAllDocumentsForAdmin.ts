import db from '@/server/db';
import { Document, DocumentUploadStatus } from '@/features/shared/types/document';
import logger from '@/server/logger';

type GetAllDocumentsForAdminInput = {
  documentUploadProviderId: string;
};

export default async function getAllDocumentsForAdmin(
  input: GetAllDocumentsForAdminInput
): Promise<Document[]> {
  try {
    const results = await db.document.findMany({
      where: {
        documentUploadProviderId: input.documentUploadProviderId,
      },
      select: {
        id: true,
        userId: true,
        filename: true,
        createdAt: true,
        uploadStatus: true,
        adminCreated: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        adminDocumentGroups: {
          select: {
            userGroup: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return results.map(document => ({
      id: document.id,
      userId: document.userId,
      filename: document.filename,
      createdAt: document.createdAt,
      uploadStatus: document.uploadStatus as DocumentUploadStatus,
      adminCreated: document.adminCreated,
      userName: document.user.name,
      userEmail: document.user.email ?? undefined,
      assignedGroupIds: document.adminDocumentGroups.map(adg => adg.userGroup.id),
      assignedGroupLabels: document.adminDocumentGroups.map(adg => adg.userGroup.label),
    }));
  } catch (error) {
    logger.error('Error getting all documents for admin', error);
    throw new Error('Error getting all documents for admin');
  }
}
