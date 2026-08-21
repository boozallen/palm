import logger from '@/server/logger';
import db from '@/server/db';
import { Prisma } from '@prisma/client';
import { UserSearchQuery, UserSearchQueryResult } from '@/features/context-studio/types/user-search';
import { resolveTimeRangeStart } from '@/features/context-studio/dal/timeRangeFilter';

type SpendRow = {
  userId: string;
  spend: number | null;
  tokens: number | null;
};

export default async function searchUsers(
  query: UserSearchQuery,
): Promise<UserSearchQueryResult> {
  try {
    const { search, membershipStatus, excludeAdmins, timeRange, userGroupId, userId, page, pageSize } = query;

    const whereClause: Prisma.UserWhereInput = {};

    const daysAgo = timeRange ? resolveTimeRangeStart(timeRange, new Date()) : null;

    if (daysAgo !== null) {
      // `lastLoginAt` is only stamped by the NextAuth sign-in event, so it is
      // null or stale for users whose sessions were restored from a JWT rather
      // than re-authenticated. Treat a user as in-window if they signed in, were
      // created, or produced any audit activity during it — otherwise a real
      // week of usage reads as zero users.
      // Kept under AND so the search filter's own OR cannot overwrite it.
      whereClause.AND = [{
        OR: [
          { lastLoginAt: { gte: daysAgo } },
          { createdAt: { gte: daysAgo } },
          { auditRecords: { some: { timestamp: { gte: daysAgo } } } },
        ],
      }];
    }

    if (userId && userId !== 'all') {
      whereClause.id = userId;
    } else if (userGroupId && userGroupId !== 'all') {
      // Scoped to a specific group — membership is implied by the group filter.
      whereClause.userGroupMemberhip = { some: { userGroupId } };
    } else if (membershipStatus === 'members') {
      // Member of 1+ groups.
      whereClause.userGroupMemberhip = { some: {} };
    } else if (membershipStatus === 'nonMembers') {
      // Not a member of any group.
      whereClause.userGroupMemberhip = { none: {} };
    }

    if (excludeAdmins) {
      whereClause.role = { not: 'Admin' };
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, totalCount] = await Promise.all([
      db.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lastLoginAt: true,
          _count: { select: { userGroupMemberhip: true } },
        },
        orderBy: { lastLoginAt: { sort: 'desc', nulls: 'last' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.user.count({ where: whereClause }),
    ]);

    const spendByUser = await getSpendByUser(users.map((u) => u.id));

    const records = users.map((user) => {
      const spend = spendByUser.get(user.id);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        groupCount: user._count.userGroupMemberhip,
        spend: spend?.spend ?? 0,
        tokens: spend?.tokens ?? 0,
      };
    });

    return { records, totalCount };
  } catch (error) {
    logger.error('Failed to search users', error);
    throw new Error('Unable to search users');
  }
}

async function getSpendByUser(userIds: string[]): Promise<Map<string, { spend: number; tokens: number }>> {
  const result = new Map<string, { spend: number; tokens: number }>();

  if (userIds.length === 0) {
    return result;
  }

  const rows = await db.$queryRaw<SpendRow[]>`
    SELECT
      "apu"."userId"::text AS "userId",
      SUM(
        "apu"."inputTokensUsed" * "apu"."costPerInputToken" +
        "apu"."outputTokensUsed" * "apu"."costPerOutputToken"
      ) AS "spend",
      SUM("apu"."inputTokensUsed" + "apu"."outputTokensUsed") AS "tokens"
    FROM "AiProviderUsage" apu
    WHERE "apu"."userId" = ANY(${userIds}::uuid[])
    GROUP BY "apu"."userId";
  `;

  rows.forEach((row) => {
    result.set(row.userId, {
      spend: Number(row.spend ?? 0),
      tokens: Number(row.tokens ?? 0),
    });
  });

  return result;
}
