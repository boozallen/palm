import z from 'zod';
import db from '@/server/db';
import { UserGroupRole } from '@/features/shared/types/user-group';
import logger from '@/server/logger';

export default async function getUserGroups(userId: string): Promise<{ id: string, label: string, role: UserGroupRole, aiProviderIds: string[], workflowsEnabled: boolean }[]> {
  try {
    const results = await db.userGroupMembership.findMany({
      include: { userGroup: { include: { aiProviders: { select: { id: true } } } } },
      where: { userId, userGroup: { deletedAt: null } },
    });
    return results.map(result => ({
      id: result.userGroup.id,
      label: result.userGroup.label,
      role: z.nativeEnum(UserGroupRole).parse(result.role),
      aiProviderIds: result.userGroup.aiProviders.map((aiProvider) => aiProvider.id),
      workflowsEnabled: result.userGroup.workflowsEnabled,
    }));
  } catch (error) {
    logger.error('Error getting user group memberships', error);
    throw new Error('Error getting user group memberships');
  }
}

