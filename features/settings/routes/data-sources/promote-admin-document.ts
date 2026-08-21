import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import promoteDocumentToAdminSource from '@/features/shared/dal/document-library/upload/promoteDocumentToAdminSource';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

const inputSchema = z
  .object({
    documentId: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    userGroupIds: z.array(z.string().uuid()).min(1),
  })
  .refine((data) => !!data.documentId || !!data.collectionId, {
    message: 'Either documentId or collectionId must be provided',
  });

const outputSchema = z.object({
  success: z.boolean(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { documentId, collectionId, userGroupIds } = input;

    const currentUser = await getUser(ctx.userId);
    const userGroups = await db.userGroup.findMany({
      where: { id: { in: userGroupIds } },
      select: { label: true },
    });
    const groupNames = userGroups.map((group) => group.label).join(', ');

    if (documentId) {
      // Handle single document promotion
      const document = await db.document.findUnique({
        where: { id: documentId },
        select: { id: true, adminCreated: true, userId: true, filename: true },
      });

      if (!document) {
        throw NotFound('Document not found');
      }

      if (document.adminCreated) {
        throw Forbidden('Document is already an admin data source');
      }

      if (ctx.userRole !== UserRole.Admin && document.userId !== ctx.userId) {
        throw Forbidden('You do not have permission to promote this document');
      }

      if (ctx.userRole !== UserRole.Admin) {
        const leadMembership = await db.userGroupMembership.findFirst({
          where: { userId: ctx.userId, role: UserGroupRole.Lead },
        });
        if (!leadMembership) {
          throw Forbidden('You do not have permission to promote documents to admin data sources');
        }
      }

      try {
        await db.$transaction(async (tx) => {
          await promoteDocumentToAdminSource({ documentId, userGroupIds, tx });
        });

        ctx.auditor.createAuditRecord({
          outcome: AuditRecordOutcome.Success,
          description: `User ${currentUser?.name} promoted document "${document.filename}" to admin data source for groups: ${groupNames}`,
          event: AuditRecordEvent.PromoteDocumentToAdminDataSource,
        });

        return { success: true };
      } catch (error) {
        ctx.auditor.createAuditRecord({
          outcome: AuditRecordOutcome.Error,
          description: `User ${currentUser?.name} failed to promote document "${document.filename}" to admin data source - ${(error as Error).message}`,
          event: AuditRecordEvent.PromoteDocumentToAdminDataSource,
        });
        throw error;
      }
    } else if (collectionId) {
      // Handle collection promotion
      const collection = await db.documentCollection.findUnique({
        where: { id: collectionId },
        select: {
          id: true,
          name: true,
          userId: true,
          memberships: {
            include: {
              document: {
                select: { id: true, adminCreated: true, userId: true, filename: true },
              },
            },
          },
        },
      });

      if (!collection) {
        throw NotFound('Collection not found');
      }

      if (ctx.userRole !== UserRole.Admin && collection.userId !== ctx.userId) {
        throw Forbidden('You do not have permission to promote this collection');
      }

      if (ctx.userRole !== UserRole.Admin) {
        const leadMembership = await db.userGroupMembership.findFirst({
          where: { userId: ctx.userId, role: UserGroupRole.Lead },
        });
        if (!leadMembership) {
          throw Forbidden('You do not have permission to promote documents to admin data sources');
        }
      }

      // Determine which documents this user can share. Already-admin documents
      // are included so re-sharing a folder re-assigns the selected groups
      // (assignAdminDocumentGroups replaces the assignment) — this is how
      // "Edit groups" works at the folder granularity.
      const documentsToPromote = collection.memberships
        .filter(m => ctx.userRole === UserRole.Admin || m.document.userId === ctx.userId);

      if (documentsToPromote.length === 0) {
        throw new Error('No documents in collection to promote');
      }

      try {
        await db.$transaction(async (tx) => {
          // Promote each document and grant access to all users in the user groups
          for (const membership of documentsToPromote) {
            await promoteDocumentToAdminSource({
              documentId: membership.document.id,
              userGroupIds,
              tx,
            });
          }

          // Flag the source folder as shared so it surfaces read-only to the
          // recipients of the promoted documents (via getCollections/getDocuments).
          // There are no per-recipient copies: one live folder, owned by the sharer.
          await tx.documentCollection.update({
            where: { id: collectionId },
            data: { adminCreated: true },
          });
        });

        ctx.auditor.createAuditRecord({
          outcome: AuditRecordOutcome.Success,
          description: `User ${currentUser?.name} promoted collection "${collection.name}" (${documentsToPromote.length} documents) to admin data source for groups: ${groupNames}`,
          event: AuditRecordEvent.PromoteDocumentCollectionToAdminDataSource,
        });

        return { success: true };
      } catch (error) {
        ctx.auditor.createAuditRecord({
          outcome: AuditRecordOutcome.Error,
          description: `User ${currentUser?.name} failed to promote collection "${collection.name}" to admin data source - ${(error as Error).message}`,
          event: AuditRecordEvent.PromoteDocumentCollectionToAdminDataSource,
        });
        throw error;
      }
    }

    // This should never happen due to the input schema refinement, but TypeScript doesn't know that
    throw new Error('Either documentId or collectionId must be provided');
  });
