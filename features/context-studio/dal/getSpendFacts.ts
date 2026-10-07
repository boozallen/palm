import { Prisma } from '@prisma/client';

import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import db from '@/server/db';
import logger from '@/server/logger';

// Which line of the panel a usage row belongs to. Only 'chat' reaches the bars;
// the other five are named in the reconciliation footer, and 'system' is reported
// as a parenthetical rather than counted in any total.
export type SpendBucket =
  | 'system'
  | 'platform'
  | 'workflow'
  | 'customAgent'
  | 'unattributed'
  | 'chat';

export type SpendFact = {
  userId: string;
  cost: number;
  bucket: SpendBucket;
  // Raw Chat.useCase, uninterpreted. Resolution to the closed vocabulary belongs
  // to services/useCaseTaxonomy.ts, not to a DAL. Never null on a 'chat' fact: a
  // row whose chat has no category is bucketed 'unattributed' instead, so the
  // Unclassified bar cannot fill up with chats nothing ever read.
  classification: string | null;
  // The group this usage row was actually attributed to, or null when it carried
  // none. getValueSummary buckets the By-team table on this, not on membership.
  userGroupId: string | null;
};

type SpendFactRow = {
  user_id: string;
  bucket: SpendBucket;
  use_case: string | null;
  cost: number | null;
  user_group_id: string | null;
};

// First match wins, and every arm's position is load-bearing:
//
// - `system` first. Classification spend rides buildSystemSource(),
//   so it is flagged system. This arm is what makes it structurally impossible
//   for the classifier to inflate the panel it populates.
// - `platform` beats chat linkage. Five rows in the live data are flagged
//   `embedding` AND carry a chatMessageId — retrieval for a conversation. They
//   belong to the platform, not to the person's work.
// - `platform` also beats workflow linkage, for the same reason: one row in the
//   live data is flagged both.
// - `customAgent` requires chatMessageId IS NULL, so a tool-use chat that sets
//   `agent` stays chat. `agent = true` does not mean agentic chat — the 70
//   chat-linked agent rows in the live data are the tool-use inference path.
// - `unattributed` catches the 27 rows that carry no attribution and no flags.
//   parseUsageAttribution treats attribution as advisory, so any internal
//   inference caller supplying none produces this shape. Without its own arm
//   they fall to the bars and read as somebody doing research.
//
//   It also catches a chat-linked row whose chat has no category at all. A NULL
//   Chat.useCase means the classifier never ran — the chat predates categorization,
//   or its summary call failed — which is not the same finding as the classifier
//   running and declining to place the conversation. The latter writes the literal
//   'unclassified' and belongs on the Unclassified bar; this one has nothing to
//   report and would otherwise make that bar hold the entire pre-feature history.
//   Folded into an existing line rather than given its own, so the footer keeps
//   four lines and the total still reconciles against the Cost tab.
//
// A row with a chatMessageId, no platform flag, and a categorized chat goes to the
// bars. That single sentence is the whole boundary.
//
// A function rather than a module-level constant: `Prisma.sql` resolves to the
// browser build under the jsdom test environment and throws when called, so
// evaluating it at import time would break every test that merely imports this
// module — getValueSummary's, for one. Called twice below, which is free: the two
// fragments are identical text.
// Exported so getUseCaseDetail selects spend under the identical CASE. A second
// copy of this expression is the one change that would let the drawer's chat rows
// stop summing to the bar they opened from.
export const chatBucketExpression = (): Prisma.Sql => Prisma.sql`
      CASE
        WHEN apu."system" = true THEN 'system'
        WHEN apu."embedding" = true OR apu."knowledgeGraph" = true THEN 'platform'
        WHEN apu."workflowExecutionId" IS NOT NULL THEN 'workflow'
        WHEN apu."agent" = true AND apu."chatMessageId" IS NULL THEN 'customAgent'
        WHEN apu."chatMessageId" IS NULL OR c."useCase" IS NULL THEN 'unattributed'
        ELSE 'chat'
      END`;

// Spend in the period, grouped by who spent it, which panel line it belongs to,
// and the column that says what the chat was for. Every AiProviderUsage row in the
// period is in exactly one group, which is what lets the panel reconcile: the bars
// sum to chat spend, and chat spend plus the four remainder lines sums to total
// spend.
//
// This used to join AgentProvider, PromptTag, WorkflowExecution and Workflow to
// recover free text for substring matching. All four are gone. The remaining
// ChatMessage → Chat hop is only there because that is how a usage row reaches its
// category.
export default async function getSpendFacts(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<SpendFact[]> {
  try {
    const adminFilter = excludeAdmins
      ? Prisma.sql`AND apu."userId" NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`
      : Prisma.empty;

    const rows = await db.$queryRaw<SpendFactRow[]>`
      SELECT
        apu."userId" AS user_id,
        ${chatBucketExpression()} AS bucket,
        c."useCase" AS use_case,
        apu."userGroupId" AS user_group_id,
        SUM(
          apu."inputTokensUsed" * apu."costPerInputToken"
          + apu."outputTokensUsed" * apu."costPerOutputToken"
        ) AS cost
      FROM "AiProviderUsage" apu
      LEFT JOIN "ChatMessage" cm ON cm.id = apu."chatMessageId"
      LEFT JOIN "Chat" c ON c.id = cm."chatId"
      WHERE 1=1
        ${buildTimeRangeFilter(timeRange, 'apu."timestamp"')}
        ${buildUserScopeFilter('apu."userId"', userGroupId, userId, 'apu."userGroupId"', true)}
        ${adminFilter}
      GROUP BY apu."userId", ${chatBucketExpression()}, c."useCase", apu."userGroupId"
    `;

    return rows.map((row) => ({
      userId: row.user_id,
      cost: Number(row.cost ?? 0),
      bucket: row.bucket,
      classification: row.use_case,
      userGroupId: row.user_group_id,
    }));
  } catch (error) {
    logger.error('Failed to load Context Studio spend facts', { error });
    throw new Error('Failed to fetch spend facts');
  }
}
