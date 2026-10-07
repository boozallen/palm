import { Prisma } from '@prisma/client';

import {
  buildPreviousPeriodFilter,
  buildSinceWindowFilter,
  buildTimeRangeStart,
  PeriodWindow,
} from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import db from '@/server/db';
import logger from '@/server/logger';

export type ArtifactKind = 'chat' | 'workflow';

export type ArtifactFact = {
  artifactId: string;
  kind: ArtifactKind;
  ownerUserId: string;
  createdAt: Date;
  // Which comparable period this artifact was created in. Both are returned in
  // one call so the KPI tiles' prior-period delta cannot drift against the
  // current-period count.
  window: PeriodWindow;
  // Raw Chat.useCase, uninterpreted, and always null for a workflow artifact.
  // Resolution to the closed vocabulary belongs to services/useCaseTaxonomy.ts.
  classification: string | null;
  // The group the chat or workflow execution was actually attributed to, or null
  // when it carried none. This is what lets getValueSummary bucket the By-team
  // table on real attribution instead of the owner's group memberships.
  userGroupId: string | null;
};

type ArtifactFactRow = {
  artifact_id: string;
  kind: ArtifactKind;
  owner_user_id: string;
  created_at: Date;
  // Not "window": that is a reserved word in Postgres and cannot be a bare
  // column alias.
  period_window: PeriodWindow;
  use_case: string | null;
  user_group_id: string | null;
};

// Every work product created in the period, chat and workflow alike, with the
// column needed to categorize it. Deliberately does not categorize anything
// itself — resolution is pure (services/useCaseTaxonomy.ts) and costing already
// has two DALs from #733. This is only the join.
//
// Workflow artifacts carry no category and are returned anyway: the tab's
// headline artifact count covers everything, and getValueSummary excludes them
// from the per-category bars on `kind`. That is why the bars' `made` column does
// not sum to the headline figure, which the footer explains on the view.
//
// Note on drift: audit records outlive artifacts, which cascade-delete with their
// chat. An artifact deleted since it was downloaded is absent here but its
// DOWNLOAD_ARTIFACT record survives, so historical put-to-work rates move
// slightly over time. Stated on the view rather than hidden.
export default async function getArtifactFacts(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<ArtifactFact[]> {
  try {
    const chatAdminFilter = excludeAdmins
      ? Prisma.sql`AND c."userId" NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`
      : Prisma.empty;
    const workflowAdminFilter = excludeAdmins
      ? Prisma.sql`AND we."triggeredBy" NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`
      : Prisma.empty;

    // Everything on or after the current window's start is 'current'; the rest is
    // the preceding window, because the WHERE clause already excludes anything
    // older than that. Forever has no start and therefore no previous window, so
    // every row is 'current'.
    const currentStart = buildTimeRangeStart(timeRange);
    const windowExpression = (field: string): Prisma.Sql => (currentStart
      ? Prisma.sql`CASE WHEN ${Prisma.raw(field)} >= ${currentStart} THEN 'current' ELSE 'previous' END`
      : Prisma.sql`'current'::text`);

    // For YearToDate, the prior window is calendar-anchored (Jan-to-today of last
    // year), not a doubled interval. Without this bound, the CASE's ELSE branch
    // would tag the entire prior calendar year as 'previous', while adoption
    // metrics compare against the span-matched window only. This keeps them aligned.
    const spanMatchedPreviousFilter = (field: string): Prisma.Sql => {
      const previousPredicate = buildPreviousPeriodFilter(timeRange, field);
      if (!currentStart || !previousPredicate) {
        // Forever: no prior window, no extra bound needed.
        return Prisma.empty;
      }
      // Anything >= currentStart is 'current' (the CASE handles that). Anything
      // older must satisfy the span-matched prior window to survive this WHERE.
      return Prisma.sql`AND (${Prisma.raw(field)} >= ${currentStart} OR (${previousPredicate}))`;
    };

    const rows = await db.$queryRaw<ArtifactFactRow[]>`
      SELECT
        ca.id AS artifact_id,
        'chat'::text AS kind,
        c."userId" AS owner_user_id,
        ca."createdAt" AS created_at,
        ${windowExpression('ca."createdAt"')} AS period_window,
        c."useCase" AS use_case,
        c."userGroupId" AS user_group_id
      FROM "ChatArtifact" ca
      JOIN "ChatMessage" cm ON cm.id = ca."chatMessageId"
      JOIN "Chat" c ON c.id = cm."chatId"
      WHERE 1=1
        ${buildSinceWindowFilter(timeRange, 'ca."createdAt"', 'previous')}
        ${spanMatchedPreviousFilter('ca."createdAt"')}
        ${buildUserScopeFilter('c."userId"', userGroupId, userId, 'c."userGroupId"')}
        ${chatAdminFilter}

      UNION ALL

      SELECT
        wa.id AS artifact_id,
        'workflow'::text AS kind,
        we."triggeredBy" AS owner_user_id,
        wa."createdAt" AS created_at,
        ${windowExpression('wa."createdAt"')} AS period_window,
        NULL::text AS use_case,
        we."userGroupId" AS user_group_id
      FROM workflow_artifacts wa
      JOIN "WorkflowExecution" we ON we.id = wa."workflowExecutionId"
      WHERE 1=1
        ${buildSinceWindowFilter(timeRange, 'wa."createdAt"', 'previous')}
        ${spanMatchedPreviousFilter('wa."createdAt"')}
        ${buildUserScopeFilter('we."triggeredBy"', userGroupId, userId, 'we."userGroupId"')}
        ${workflowAdminFilter}
    `;

    return rows.map((row) => ({
      artifactId: row.artifact_id,
      kind: row.kind,
      ownerUserId: row.owner_user_id,
      createdAt: row.created_at,
      window: row.period_window,
      classification: row.use_case,
      userGroupId: row.user_group_id,
    }));
  } catch (error) {
    logger.error('Failed to load Context Studio work product facts', { error });
    throw new Error('Failed to fetch work product facts');
  }
}
