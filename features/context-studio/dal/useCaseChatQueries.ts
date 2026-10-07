import { Prisma } from '@prisma/client';

import { chatBucketExpression } from '@/features/context-studio/dal/getSpendFacts';
import { buildTimeRangeFilter, buildSinceWindowFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';
import { buildUseCaseSqlFilter } from '@/features/context-studio/services/useCaseTaxonomy';
import { USE_CASE_DETAIL_CHAT_LIMIT } from '@/features/context-studio/types/use-case-detail';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import db from '@/server/db';

// The chats and work products one category resolves to. The drawer's figures and its
// theme roll-up both read these, and they have to be the same rows or the roll-up
// describes work the drawer never listed.
export type UseCaseScope = {
  useCase: UseCase;
  timeRange: TimeRange;
  userGroupId: string;
  userId: string;
  excludeAdmins: boolean;
  excludeUnattributed?: boolean;
};

export type UseCaseChatQueryRow = {
  chat_id: string;
  title: string | null;
  owner_user_id: string;
  owner_name: string | null;
  owner_email: string | null;
  cost: number | null;
  created_at: Date;
};

export type UseCaseArtifactQueryRow = {
  artifact_id: string;
  name: string;
  chat_id: string;
  owner_user_id: string;
  user_group_id: string | null;
  group_label: string | null;
};

// One row's spend, defined once: every aggregate that reports category dollars
// derives from it, so no two of them can drift apart.
export const rowCostExpression = (): Prisma.Sql => Prisma.sql`
  apu."inputTokensUsed" * apu."costPerInputToken"
  + apu."outputTokensUsed" * apu."costPerOutputToken"`;

export const costExpression = (): Prisma.Sql => Prisma.sql`SUM(${rowCostExpression()})`;

// Spend filters on the usage row's owner; a ChatArtifact has no usage row, so it
// filters on the chat's owner instead. Keeping the two apart stops a query from
// silently applying the predicate that doesn't fit the table it reads.
export const buildUsageAdminFilter = (excludeAdmins: boolean): Prisma.Sql => (excludeAdmins
  ? Prisma.sql`AND apu."userId" NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`
  : Prisma.empty);

const buildChatAdminFilter = (excludeAdmins: boolean): Prisma.Sql => (excludeAdmins
  ? Prisma.sql`AND c."userId" NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`
  : Prisma.empty);

export function queryUseCaseChats(scope: UseCaseScope): Promise<UseCaseChatQueryRow[]> {
  const { useCase, timeRange, userGroupId, userId, excludeAdmins, excludeUnattributed } = scope;

  return db.$queryRaw<UseCaseChatQueryRow[]>`
    SELECT c.id AS chat_id, c.summary AS title, c."userId" AS owner_user_id,
           u.name AS owner_name, u.email AS owner_email, c."createdAt" AS created_at,
           ${costExpression()} AS cost
    FROM "AiProviderUsage" apu
    JOIN "ChatMessage" cm ON cm.id = apu."chatMessageId"
    JOIN "Chat" c ON c.id = cm."chatId"
    JOIN "User" u ON u.id = c."userId"
    WHERE ${chatBucketExpression()} = 'chat'
      AND ${buildUseCaseSqlFilter(useCase)}
      ${buildTimeRangeFilter(timeRange, 'apu."timestamp"')}
      ${buildUserScopeFilter('apu."userId"', userGroupId, userId, 'apu."userGroupId"', excludeUnattributed)}
      ${buildUsageAdminFilter(excludeAdmins)}
    GROUP BY c.id, c.summary, c."userId", u.name, u.email, c."createdAt"
    ORDER BY cost DESC
    LIMIT ${USE_CASE_DETAIL_CHAT_LIMIT}
  `;
}

export function queryUseCaseArtifacts(scope: UseCaseScope): Promise<UseCaseArtifactQueryRow[]> {
  const { useCase, timeRange, userGroupId, userId, excludeAdmins } = scope;

  return db.$queryRaw<UseCaseArtifactQueryRow[]>`
    SELECT ca.id AS artifact_id, ca.label || ca."fileExtension" AS name,
           c.id AS chat_id, c."userId" AS owner_user_id,
           c."userGroupId" AS user_group_id, ug.label AS group_label
    FROM "ChatArtifact" ca
    JOIN "ChatMessage" cm ON cm.id = ca."chatMessageId"
    JOIN "Chat" c ON c.id = cm."chatId"
    LEFT JOIN "UserGroup" ug ON ug.id = c."userGroupId"
    WHERE ${buildUseCaseSqlFilter(useCase)}
      ${buildSinceWindowFilter(timeRange, 'ca."createdAt"', 'current')}
      ${buildUserScopeFilter('c."userId"', userGroupId, userId, 'c."userGroupId"')}
      ${buildChatAdminFilter(excludeAdmins)}
    -- Newest first because the list is displayed truncated: oldest-first showed a busy
    -- category its stalest work products. Callers count every row and are
    -- order-independent, so this only affects what is shown.
    ORDER BY ca."createdAt" DESC
  `;
}
