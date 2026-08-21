import db from '@/server/db';
import logger from '@/server/logger';

// Called when a user joins a group. Grants access to all admin data sources
// assigned to that group.
export async function syncAdminDocumentUsersOnGroupJoin(
  userId: string,
  userGroupId: string,
): Promise<void> {
  try {
    const adminDocumentGroups = await db.adminDocumentGroup.findMany({
      where: { userGroupId },
      select: { documentId: true },
    });

    if (adminDocumentGroups.length === 0) {
      return;
    }

    await db.$transaction(
      adminDocumentGroups.map(({ documentId }) =>
        db.document.update({
          where: { id: documentId },
          data: { accessUsers: { connect: { id: userId } } },
        })
      )
    );
  } catch (error) {
    logger.error(
      `Error syncing admin document access on group join: UserId: ${userId}, GroupId: ${userGroupId}`,
      error,
    );
    throw new Error('Error syncing admin document access');
  }
}

// Called when a user leaves a group. Revokes access to admin data sources
// assigned to that group, unless the user still belongs to another group
// that has access to the same document.
export async function syncAdminDocumentUsersOnGroupLeave(
  userId: string,
  userGroupId: string,
): Promise<void> {
  try {
    const adminDocumentGroups = await db.adminDocumentGroup.findMany({
      where: { userGroupId },
      select: { documentId: true },
    });

    if (adminDocumentGroups.length === 0) {
      return;
    }

    // For each affected document, check whether the user retains access via
    // another group before revoking.
    const userRemainingMemberships = await db.userGroupMembership.findMany({
      where: {
        userId,
        userGroupId: { not: userGroupId },
      },
      select: { userGroupId: true },
    });

    const remainingGroupIds = userRemainingMemberships.map(m => m.userGroupId);

    const documentsToRevoke: string[] = [];

    for (const { documentId } of adminDocumentGroups) {
      if (remainingGroupIds.length > 0) {
        const retainedAccess = await db.adminDocumentGroup.findFirst({
          where: {
            documentId,
            userGroupId: { in: remainingGroupIds },
          },
        });
        if (retainedAccess) {
          continue;
        }
      }
      documentsToRevoke.push(documentId);
    }

    if (documentsToRevoke.length === 0) {
      return;
    }

    await db.$transaction(
      documentsToRevoke.map(documentId =>
        db.document.update({
          where: { id: documentId },
          data: { accessUsers: { disconnect: { id: userId } } },
        })
      )
    );
  } catch (error) {
    logger.error(
      `Error syncing admin document access on group leave: UserId: ${userId}, GroupId: ${userGroupId}`,
      error,
    );
    throw new Error('Error syncing admin document access');
  }
}
