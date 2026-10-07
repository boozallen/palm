import { Prisma } from '@prisma/client';

import { matchesUserGroup } from '@/features/shared/dal/aiProviderUsageAttribution';

// ANDs the userId and userGroupId predicates together instead of treating a
// specific userId as replacing the group constraint, so a Lead's userId-scoped
// query still can't reach a user outside the group scopeStudioQuery authorized
// them for. `userField` and `userGroupField` are pre-quoted column references
// inserted with Prisma.raw, so callers must never pass user input here.
//
// `userGroupField` names a column holding the group the work was actually performed
// under (AiProviderUsage."userGroupId" and friends). Pass it wherever the table
// has one: that column then decides attribution on its own, matching only rows
// explicitly tagged with the group, since membership reflects a user's current
// groups, not which group the work was actually performed under. Rows written
// before per-action attribution shipped are excluded rather than membership-
// matched. Omit userGroupField and the predicate stays membership-only, which is
// all a table without such a column can support. Both Context Studio's Value
// tab and its Usage Records tab go through here, so the two cannot report
// different spend for the same group.
//
// `excludeUnattributed` additionally drops rows with no group at all when no
// group is selected (userGroupId === 'all'). One place for this keeps every
// "all"-scoped caller in agreement instead of each hand-copying the check.
export function buildUserScopeFilter(
  userField: string,
  userGroupId: string,
  userId: string,
  userGroupField?: string,
  excludeUnattributed = false,
): Prisma.Sql {
  const userFilter = userId !== 'all'
    ? Prisma.sql`AND ${Prisma.raw(userField)} = CAST(${userId} AS UUID)`
    : Prisma.empty;

  let groupFilter = Prisma.empty;
  if (userGroupId !== 'all') {
    groupFilter = userGroupField
      ? Prisma.sql`AND ${matchesUserGroup(userGroupField, userGroupId)}`
      : Prisma.sql`
          AND ${Prisma.raw(userField)} IN (
            SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
          )
        `;
  } else if (userGroupField && excludeUnattributed) {
    groupFilter = Prisma.sql`AND ${Prisma.raw(userGroupField)} IS NOT NULL`;
  }

  return Prisma.sql`${userFilter} ${groupFilter}`;
}
