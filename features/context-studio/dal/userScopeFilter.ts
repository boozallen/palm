import { Prisma } from '@prisma/client';

// ANDs the userId and userGroupId predicates together instead of treating a
// specific userId as replacing the group constraint, so a Lead's userId-scoped
// query still can't reach a user outside the group scopeStudioQuery authorized
// them for. `userField` is a pre-quoted column reference inserted with
// Prisma.raw, so callers must never pass user input here.
export function buildUserScopeFilter(
  userField: string,
  userGroupId: string,
  userId: string,
): Prisma.Sql {
  const userFilter = userId !== 'all'
    ? Prisma.sql`AND ${Prisma.raw(userField)} = CAST(${userId} AS UUID)`
    : Prisma.empty;

  const groupFilter = userGroupId !== 'all'
    ? Prisma.sql`
        AND ${Prisma.raw(userField)} IN (
          SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
        )
      `
    : Prisma.empty;

  return Prisma.sql`${userFilter} ${groupFilter}`;
}
