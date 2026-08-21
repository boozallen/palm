import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getStudioUserGroups from '@/features/context-studio/dal/getStudioUserGroups';
import getUserContextStudioAccess from '@/features/shared/dal/getUserContextStudioAccess';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';

export type StudioQueryScope = {
  // Whether the viewer may see every member's individual data for the
  // requested group: true for Admins, or the group's own Lead.
  isLead: boolean;
  // The requested `userId`, with 'all' additionally forced down to the
  // viewer's own id when not privileged, for views that name every member
  // unconditionally (activity swimlanes, session paths) rather than only when
  // a specific `userId` is requested. Views that only ever name a member when
  // `userId` is explicitly requested can keep using the raw input instead —
  // this call still throws for those views if that request wasn't allowed.
  restrictedUserId: string;
};

/**
 * Every Context Studio tab shares one filter bar (userGroupId + userId), so the
 * access and Lead/Member scoping rules live here once instead of once per tab.
 *
 * - Throws unless the viewer holds the Context Studio grant.
 * - Throws if `userGroupId` names a group the viewer may not filter by, closing
 *   the org-wide group-enumeration gap PR #793 fixed for the Cost tab.
 * - Throws if `userId` names a member other than the viewer, unless the viewer
 *   is an Admin or that specific group's Lead — a plain member of a group they
 *   don't lead may only ever see their own individual data within it.
 * - Throws if a Lead names a `userId` who isn't actually a member of the named
 *   group — a Lead's authority doesn't extend to users outside the group they
 *   lead, even ones they otherwise know the id of.
 */
export default async function scopeStudioQuery(
  ctx: { userId: string; userRole: UserRole },
  requestedUserGroupId: string,
  requestedUserId: string,
): Promise<StudioQueryScope> {
  const hasAccess = await getUserContextStudioAccess(ctx.userId);

  if (!hasAccess) {
    throw Forbidden('You do not have permission to access this resource');
  }

  const isAdmin = ctx.userRole === UserRole.Admin;
  let isLeadOfRequestedGroup = isAdmin;

  if (!isAdmin && requestedUserGroupId !== 'all') {
    const visibleGroups = await getStudioUserGroups(ctx.userId, false);
    const requestedGroup = visibleGroups.find((userGroup) => userGroup.id === requestedUserGroupId);

    if (!requestedGroup) {
      throw Forbidden('You do not have permission to access this resource');
    }

    isLeadOfRequestedGroup = requestedGroup.isLead;
  }

  if (!isLeadOfRequestedGroup && requestedUserId !== 'all' && requestedUserId !== ctx.userId) {
    throw Forbidden('You do not have permission to access this resource');
  }

  // A Lead's authority comes from leading the requested group, so it only
  // covers members of that group — pairing it with a userId from outside the
  // group would otherwise let a Lead read any org user's individual data.
  const isNamingAnotherMember = isLeadOfRequestedGroup && !isAdmin &&
    requestedUserId !== 'all' && requestedUserId !== ctx.userId;

  if (isNamingAnotherMember) {
    const targetMembership = await getUserGroupMembership(requestedUserId, requestedUserGroupId);

    if (!targetMembership) {
      throw Forbidden('You do not have permission to access this resource');
    }
  }

  return {
    isLead: isLeadOfRequestedGroup,
    restrictedUserId: isLeadOfRequestedGroup ? requestedUserId : ctx.userId,
  };
}
