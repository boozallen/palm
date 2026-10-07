import { Prisma } from '@prisma/client';

import { chatBucketExpression } from '@/features/context-studio/dal/getSpendFacts';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';
import { buildUseCaseSqlFilter } from '@/features/context-studio/services/useCaseTaxonomy';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import db from '@/server/db';
import logger from '@/server/logger';

// Whether one chat is inside the set the drawer's chat list would show. Built from
// the same filters as getUseCaseDetail's chat query, so a row the viewer was offered
// can always be opened and one they were never shown never can.
export default async function isChatInUseCaseScope(
  chatId: string,
  useCase: UseCase,
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = true,
): Promise<boolean> {
  try {
    const adminFilter = excludeAdmins
      ? Prisma.sql`AND apu."userId" NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`
      : Prisma.empty;

    const rows = await db.$queryRaw<{ in_scope: number }[]>`
      SELECT 1 AS in_scope
      FROM "AiProviderUsage" apu
      JOIN "ChatMessage" cm ON cm.id = apu."chatMessageId"
      JOIN "Chat" c ON c.id = cm."chatId"
      WHERE c.id = ${chatId}::uuid
        AND ${chatBucketExpression()} = 'chat'
        AND ${buildUseCaseSqlFilter(useCase)}
        ${buildTimeRangeFilter(timeRange, 'apu."timestamp"')}
        ${buildUserScopeFilter('apu."userId"', userGroupId, userId, 'apu."userGroupId"', true)}
        ${adminFilter}
      LIMIT 1
    `;

    return rows.length > 0;
  } catch (error) {
    logger.error('Failed to check whether a chat is in a use case scope', { error });
    throw new Error('Failed to verify chat access');
  }
}
