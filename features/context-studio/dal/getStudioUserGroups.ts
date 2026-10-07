import db from '@/server/db';
import logger from '@/server/logger';
import { UserGroupRole } from '@/features/shared/types/user-group';

export type StudioUserGroup = {
  id: string;
  label: string;
  // Whether the viewer may see every member's individual cost/usage for this
  // group, rather than only their own row: Admins always can, a group Lead can
  // for the groups they lead.
  isLead: boolean;
};

/**
 * The user groups a Context Studio viewer may filter by, tagged with whether
 * the viewer leads each one.
 *
 * Admins see every group, flagged as led. Everyone else sees only their own
 * groups that have Context Studio enabled, so holding a membership in one
 * group does not let a viewer enumerate the rest of the organization through
 * the filter dropdown; each is flagged led only if their membership role in
 * that specific group is Lead.
 *
 * @param userId - The viewer whose memberships scope the list
 * @param isAdmin - Whether the viewer holds the Admin role
 * @returns The groups the viewer may filter by, by label
 */
export default async function getStudioUserGroups(
  userId: string,
  isAdmin: boolean,
): Promise<StudioUserGroup[]> {
  try {
    if (isAdmin) {
      const userGroups = await db.userGroup.findMany({
        where: { deletedAt: null },
        select: { id: true, label: true },
        orderBy: { label: 'asc' },
      });

      return userGroups.map((userGroup) => ({ ...userGroup, isLead: true }));
    }

    const userGroups = await db.userGroup.findMany({
      where: {
        deletedAt: null,
        contextStudioEnabled: true,
        userGroupMemberships: { some: { userId } },
      },
      select: {
        id: true,
        label: true,
        userGroupMemberships: { where: { userId }, select: { role: true } },
      },
      orderBy: {
        label: 'asc',
      },
    });

    return userGroups.map((userGroup) => ({
      id: userGroup.id,
      label: userGroup.label,
      isLead: userGroup.userGroupMemberships.some(
        (membership) => membership.role === UserGroupRole.Lead,
      ),
    }));
  } catch (error) {
    logger.error('Error getting Context Studio user groups', error);
    throw new Error('Error getting Context Studio user groups');
  }
}
