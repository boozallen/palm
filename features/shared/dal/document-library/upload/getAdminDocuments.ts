import db from '@/server/db';
import { AdminDocument, DocumentUploadStatus, GraphJobInfo } from '@/features/shared/types/document';
import logger from '@/server/logger';
import getDocumentLineage from './getDocumentLineage';

type GetAdminDocumentsInput = {
  userId: string;
  isAdmin?: boolean;
};

export default async function getAdminDocuments(
  input: GetAdminDocumentsInput
): Promise<AdminDocument[]> {
  try {
    // Return ALL documents if user is admin, or just the user's own documents if they're a group lead
    const results = await db.document.findMany({
      where: input.isAdmin ? {} : { userId: input.userId },
      select: {
        id: true,
        userId: true,
        filename: true,
        createdAt: true,
        uploadStatus: true,
        text: true,
        adminCreated: true,
        user: {
          select: {
            name: true,
            email: true,
            userGroupMemberhip: {
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
        },
        adminDocumentGroups: {
          select: {
            userGroupId: true,
            userGroup: {
              select: {
                label: true,
              },
            },
          },
        },
        sharedDocuments: {
          select: {
            id: true,
            actions: {
              select: {
                status: true,
              },
            },
            sharedWithUserGroupIds: true,
          },
        },
        // Folder membership for the admin view's folder grouping. Includes the
        // collection's `shared` flag and owner so the UI can label/group folders
        // and gate the per-folder Share action.
        collectionMemberships: {
          select: {
            collection: {
              select: {
                id: true,
                name: true,
                color: true,
                adminCreated: true,
                userId: true,
                user: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch lineage and graph metadata for all documents in parallel
    const documentsWithLineage = await Promise.all(
      results.map(async (document) => {
        const lineage = await getDocumentLineage(document.id);

        // Find the most recent graph metadata for this document
        const graphMetadata = await db.graphMetadata.findFirst({
          where: {
            userId: document.userId,
            documentIds: {
              has: document.id,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            status: true,
            buildProgress: true,
            completedAt: true,
            errorMessage: true,
          },
        });

        let graphJobInfo: GraphJobInfo | undefined;
        if (graphMetadata) {
          const progress = graphMetadata.buildProgress as { totalChunks?: number; processedChunks?: number; currentStep?: string } | null;
          graphJobInfo = {
            status: graphMetadata.status as 'Pending' | 'Building' | 'Resolving' | 'Completed' | 'Failed',
            progress: progress ?? undefined,
            completedAt: graphMetadata.completedAt ?? undefined,
            errorMessage: graphMetadata.errorMessage ?? undefined,
          };
        }

        // Calculate share status counts
        const shareStatusCounts = {
          pending: 0,
          accepted: 0,
          rejected: 0,
        };

        document.sharedDocuments.forEach((sharedDoc) => {
          const actionStatuses = new Set(sharedDoc.actions.map(a => a.status));
          const totalTargetUsers = sharedDoc.sharedWithUserGroupIds.length;
          const totalActions = sharedDoc.actions.length;

          shareStatusCounts.accepted += sharedDoc.actions.filter(a => a.status === 'accepted').length;
          shareStatusCounts.rejected += sharedDoc.actions.filter(a => a.status === 'rejected').length;

          // Pending = total potential recipients minus actions taken
          // This is a simplification; accurate count would require user group membership lookup
          if (totalActions < totalTargetUsers) {
            shareStatusCounts.pending += (totalTargetUsers - totalActions);
          }
        });

        return {
          id: document.id,
          userId: document.userId,
          filename: document.filename,
          createdAt: document.createdAt,
          uploadStatus: document.uploadStatus as DocumentUploadStatus,
          text: document.text ?? undefined,
          adminCreated: document.adminCreated,
          userName: document.user.name,
          userEmail: document.user.email ?? undefined,
          assignedGroupIds: document.adminDocumentGroups.map(g => g.userGroupId),
          assignedGroupLabels: document.adminDocumentGroups.map(g => g.userGroup.label),
          userGroupMemberships: document.user.userGroupMemberhip.map(m => ({
            id: m.userGroup.id,
            label: m.userGroup.label,
          })),
          lineage,
          graphJobInfo,
          shareStatusCounts,
          collections: document.collectionMemberships.map(cm => ({
            id: cm.collection.id,
            name: cm.collection.name,
            color: cm.collection.color,
            shared: cm.collection.adminCreated,
            ownerId: cm.collection.userId,
            ownerName: cm.collection.user.name ?? undefined,
          })),
        };
      })
    );

    return documentsWithLineage;
  } catch (error) {
    logger.error(`Error getting admin documents: UserId: ${input.userId}`, error);
    throw new Error('Error getting admin documents');
  }
}
