import { Prisma } from '@prisma/client';

import logger from '@/server/logger';

type AssignAdminDocumentGroupsInput = {
  documentId: string;
  userGroupIds: string[];
  tx: Prisma.TransactionClient;
};

// Replaces the group assignments for an admin data source and syncs accessUsers
// to match the full membership of the newly assigned groups.
export default async function assignAdminDocumentGroups(
  input: AssignAdminDocumentGroupsInput
): Promise<void> {
  try {
    // Replace group assignments
    await input.tx.adminDocumentGroup.deleteMany({
      where: { documentId: input.documentId },
    });

    if (input.userGroupIds.length > 0) {
      await input.tx.adminDocumentGroup.createMany({
        data: input.userGroupIds.map(userGroupId => ({
          documentId: input.documentId,
          userGroupId,
        })),
      });
    }

    // Resolve the full set of users across all assigned groups
    const memberships = await input.tx.userGroupMembership.findMany({
      where: { userGroupId: { in: input.userGroupIds } },
      select: { userId: true },
    });

    const uniqueUserIds = [...new Set(memberships.map(m => m.userId))];

    // Replace accessUsers to match the resolved membership
    await input.tx.document.update({
      where: { id: input.documentId },
      data: {
        accessUsers: {
          set: uniqueUserIds.map(id => ({ id })),
        },
      },
    });
  } catch (error) {
    logger.error(`Error assigning admin document groups: DocumentId: ${input.documentId}`, error);
    throw new Error('Error assigning admin document groups');
  }
}
