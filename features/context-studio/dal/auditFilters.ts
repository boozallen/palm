import { Prisma } from '@prisma/client';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';

// Builds the optional `AND …` predicates shared by every Context Studio behavior
// view, matching on the `ar` alias used inside the sessionized CTE's `scoped`
// query. Each view feeds the result straight into `sessionizedRecords(filters)`,
// so the top filter bar behaves identically everywhere and no view invents its
// own filters.
export function buildAuditFilters(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins: boolean,
): Prisma.Sql {
  const timeFilter = buildTimeRangeFilter(timeRange, 'ar."timestamp"');

  const adminFilter = excludeAdmins
    ? Prisma.sql`AND ar."userId" NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`
    : Prisma.empty;

  const userFilter = userId !== 'all'
    ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)`
    : Prisma.empty;

  const groupFilter = userGroupId !== 'all'
    ? Prisma.sql`AND ar."userId" IN (
        SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
      )`
    : Prisma.empty;

  return Prisma.sql`${timeFilter} ${userFilter} ${groupFilter} ${adminFilter}`;
}
