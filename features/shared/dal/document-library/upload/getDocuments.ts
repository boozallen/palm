import db from '@/server/db';
import logger from '@/server/logger';

import { Document, DocumentUploadStatus, DataProfile } from '@/features/shared/types/document';

type GetDocumentsInput = {
  userId: string;
  documentUploadProviderId: string | null;
};

export default async function getDocuments(
  input: GetDocumentsInput
): Promise<Document[]> {
  if (!input.documentUploadProviderId) {
    return [];
  }

  try {
    const results = await db.document.findMany({
      where: {
        documentUploadProviderId: input.documentUploadProviderId,
        OR: [
          { userId: input.userId },
          {
            adminCreated: true,
            accessUsers: { some: { id: input.userId } },
          },
        ],
      },
      select: {
        id: true,
        userId: true,
        filename: true,
        createdAt: true,
        uploadStatus: true,
        adminCreated: true,
        dataProfile: true,
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
        // The user's OWN collections plus any `shared` collection the doc lives
        // in. A `shared` collection is the owner's folder surfaced read-only to
        // recipients; the document-level access guard above already guarantees
        // the user can access this doc, so surfacing its shared-folder
        // membership is safe (and keeps non-shared owner folders from leaking).
        collectionMemberships: {
          where: { collection: { OR: [{ userId: input.userId }, { adminCreated: true }] } },
          select: {
            collection: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    return results.map(document => ({
      id: document.id,
      userId: document.userId,
      filename: document.filename,
      createdAt: document.createdAt,
      uploadStatus: document.uploadStatus as DocumentUploadStatus,
      adminCreated: document.adminCreated,
      dataProfile: document.dataProfile as DataProfile | null,
      assignedGroupIds: document.adminDocumentGroups.map(adg => adg.userGroup.id),
      assignedGroupLabels: document.adminDocumentGroups.map(adg => adg.userGroup.label),
      collections: document.collectionMemberships.map(cm => cm.collection),
    }));
  } catch (error) {
    logger.error('Error getting documents', error);
    throw new Error('Error getting documents');
  }
}
