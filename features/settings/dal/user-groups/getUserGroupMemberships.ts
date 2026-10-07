import db from '@/server/db';
import logger from '@/server/logger';
import { UserGroupMembership, UserGroupRole } from '@/features/shared/types/user-group';
import { matchesUserGroup } from '@/features/shared/dal/aiProviderUsageAttribution';

type UsageRow = {
  userId: string;
  cost: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  monthlyCost: number | null;
  monthlyInputTokens: number | null;
  monthlyOutputTokens: number | null;
};

// Monthly figures are computed live off "timestamp" rather than stored/reset anywhere.
async function getUsageByUser(userGroupId: string): Promise<Map<string, UsageRow>> {
  const rows = await db.$queryRaw<UsageRow[]>`
    SELECT
      "apu"."userId",
      SUM("apu"."inputTokensUsed" * "apu"."costPerInputToken" + "apu"."outputTokensUsed" * "apu"."costPerOutputToken") AS "cost",
      SUM("apu"."inputTokensUsed") AS "inputTokens",
      SUM("apu"."outputTokensUsed") AS "outputTokens",
      SUM(CASE WHEN "apu"."timestamp" >= date_trunc('month', CURRENT_DATE)
        THEN "apu"."inputTokensUsed" * "apu"."costPerInputToken" + "apu"."outputTokensUsed" * "apu"."costPerOutputToken"
        ELSE 0 END) AS "monthlyCost",
      SUM(CASE WHEN "apu"."timestamp" >= date_trunc('month', CURRENT_DATE)
        THEN "apu"."inputTokensUsed" ELSE 0 END) AS "monthlyInputTokens",
      SUM(CASE WHEN "apu"."timestamp" >= date_trunc('month', CURRENT_DATE)
        THEN "apu"."outputTokensUsed" ELSE 0 END) AS "monthlyOutputTokens"
    FROM "AiProviderUsage" apu
    WHERE ${matchesUserGroup('"apu"."userGroupId"', userGroupId)}
    GROUP BY "apu"."userId"
  `;

  return new Map(rows.map((row) => [row.userId, row]));
}

export default async function getUserGroupMemberships(id: string): Promise<UserGroupMembership[]> {
  try {
    const userGroupMemberships = await db.userGroupMembership.findMany({
      where: {
        userGroupId: id,
      },
      include: {
        user: true,
      },
    });

    const usageByUser = await getUsageByUser(id);

    const memberships = userGroupMemberships.map((membership) => {
      const usage = usageByUser.get(membership.userId);
      return {
        userGroupId: membership.userGroupId,
        userId: membership.userId,
        name: membership.user.name,
        role: membership.role as UserGroupRole,
        email: membership.user.email,
        lastLoginAt: membership.user.lastLoginAt,
        cost: usage?.cost ?? 0,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        monthlyCost: usage?.monthlyCost ?? 0,
        monthlyInputTokens: usage?.monthlyInputTokens ?? 0,
        monthlyOutputTokens: usage?.monthlyOutputTokens ?? 0,
      };
    });

    return memberships;

  } catch (error) {
    logger.error('Error getting user group memberships', error);
    throw new Error('Error getting user group memberships');
  }
};
