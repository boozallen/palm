import { UserGroup } from '@/features/shared/types/user-group';
import logger from '@/server/logger';
import db from '@/server/db';

/**
 * Gets a specific user group by id.
 * @param {string} id
 */

export default async function getUserGroup(id: string): Promise<UserGroup> {
  try {
    const result = await db.userGroup.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: { userGroupMemberships: true },
        },
      },
    });

    const output: UserGroup = {
      id: result.id,
      label: result.label,
      joinCode: result.joinCode,
      graphDatabaseEnabled: (result as any).graphDatabaseEnabled ?? false,
      workflowsEnabled: (result as any).workflowsEnabled ?? false,
      agenticChatEnabled: (result as any).agenticChatEnabled ?? false,
      contextStudioEnabled: (result as any).contextStudioEnabled ?? false,
      monthlyBudget: result.monthlyBudget,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      memberCount: result._count.userGroupMemberships,
    };

    return output;

  } catch (error) {
    logger.error('Error getting user group', error);
    throw new Error('Error getting user group');
  }
}
