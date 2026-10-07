import { chatBucketExpression } from '@/features/context-studio/dal/getSpendFacts';
import { buildUseCaseSqlFilter } from '@/features/context-studio/services/useCaseTaxonomy';
import {
  UseCaseDetail,
  UseCaseChatRow,
  UseCasePersonRow,
  UseCaseTeamRow,
  UseCaseArtifactRow,
  UseCaseWeekPoint,
  UseCaseEgressSignal,
} from '@/features/context-studio/types/use-case-detail';
import getArtifactEgress, { isPutToWork } from '@/features/context-studio/dal/getArtifactEgress';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';
import {
  buildUsageAdminFilter,
  costExpression,
  queryUseCaseArtifacts,
  queryUseCaseChats,
  rowCostExpression,
  UseCaseArtifactQueryRow,
} from '@/features/context-studio/dal/useCaseChatQueries';
import { UNATTRIBUTED_TEAM_LABEL } from '@/features/context-studio/dal/getValueSummary';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import db from '@/server/db';
import logger from '@/server/logger';

type SpendRow = {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_group_id: string | null;
  group_label: string | null;
  chats: bigint;
  cost: number | null;
};

type WeeklyRow = {
  week_start: Date;
  category_cost: number | null;
  chat_cost: number | null;
};

type TotalRow = {
  total: bigint;
};

export default async function getUseCaseDetail(
  useCase: UseCase,
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = true,
): Promise<UseCaseDetail> {
  try {
    const scope = { useCase, timeRange, userGroupId, userId, excludeAdmins, excludeUnattributed: true };
    const adminFilter = buildUsageAdminFilter(excludeAdmins);

    // Five independent reads: nothing here consumes another's output, so a drawer
    // open costs one round trip instead of five.
    const [chatRows, spendRows, weeklyRows, artifactRows, totalResult] = await Promise.all([
      queryUseCaseChats(scope),
      // Excludes unattributed rows like the other reads below: people/teams cost
      // and chat counts must agree with the header, trend, and total. An owner whose
      // only activity is unattributed still surfaces via the artifact-only fallback
      // below, with cost and chats left at zero rather than counting work we can't
      // attribute to a team.
      db.$queryRaw<SpendRow[]>`
        SELECT apu."userId" AS user_id,
               pu.name AS user_name,
               pu.email AS user_email,
               apu."userGroupId" AS user_group_id,
               ug.label AS group_label,
               COUNT(DISTINCT c.id) AS chats,
               ${costExpression()} AS cost
        FROM "AiProviderUsage" apu
        JOIN "ChatMessage" cm ON cm.id = apu."chatMessageId"
        JOIN "Chat" c ON c.id = cm."chatId"
        LEFT JOIN "User" pu ON pu.id = apu."userId"
        LEFT JOIN "UserGroup" ug ON ug.id = apu."userGroupId"
        WHERE ${chatBucketExpression()} = 'chat'
          AND ${buildUseCaseSqlFilter(useCase)}
          ${buildTimeRangeFilter(timeRange, 'apu."timestamp"')}
          ${buildUserScopeFilter('apu."userId"', userGroupId, userId, 'apu."userGroupId"', true)}
          ${adminFilter}
        GROUP BY apu."userId", pu.name, pu.email, apu."userGroupId", ug.label
      `,
      db.$queryRaw<WeeklyRow[]>`
        SELECT date_trunc('week', apu."timestamp") AS week_start,
               SUM(CASE WHEN ${buildUseCaseSqlFilter(useCase)}
                   THEN ${rowCostExpression()}
                   ELSE 0 END) AS category_cost,
               ${costExpression()} AS chat_cost
        FROM "AiProviderUsage" apu
        JOIN "ChatMessage" cm ON cm.id = apu."chatMessageId"
        JOIN "Chat" c ON c.id = cm."chatId"
        WHERE ${chatBucketExpression()} = 'chat'
          ${buildTimeRangeFilter(timeRange, 'apu."timestamp"')}
          ${buildUserScopeFilter('apu."userId"', userGroupId, userId, 'apu."userGroupId"', true)}
          ${adminFilter}
        GROUP BY 1
        ORDER BY 1
      `,
      queryUseCaseArtifacts(scope),
      db.$queryRaw<TotalRow[]>`
        SELECT COUNT(DISTINCT c.id) AS total
        FROM "AiProviderUsage" apu
        JOIN "ChatMessage" cm ON cm.id = apu."chatMessageId"
        JOIN "Chat" c ON c.id = cm."chatId"
        WHERE ${chatBucketExpression()} = 'chat'
          AND ${buildUseCaseSqlFilter(useCase)}
          ${buildTimeRangeFilter(timeRange, 'apu."timestamp"')}
          ${buildUserScopeFilter('apu."userId"', userGroupId, userId, 'apu."userGroupId"', true)}
          ${adminFilter}
      `,
    ]);

    const artifactIds = artifactRows.map((row) => row.artifact_id);

    const egressMap = await getArtifactEgress(artifactIds, timeRange, 'current');

    const artifactsByChat = new Map<string, UseCaseArtifactQueryRow[]>();
    artifactRows.forEach((row) => {
      const list = artifactsByChat.get(row.chat_id) ?? [];
      list.push(row);
      artifactsByChat.set(row.chat_id, list);
    });

    const artifactsByUser = new Map<string, UseCaseArtifactQueryRow[]>();
    artifactRows.forEach((row) => {
      const list = artifactsByUser.get(row.owner_user_id) ?? [];
      list.push(row);
      artifactsByUser.set(row.owner_user_id, list);
    });

    const artifactsByGroup = new Map<string | null, UseCaseArtifactQueryRow[]>();
    artifactRows.forEach((row) => {
      const list = artifactsByGroup.get(row.user_group_id) ?? [];
      list.push(row);
      artifactsByGroup.set(row.user_group_id, list);
    });

    const buildSignals = (artifactId: string): UseCaseEgressSignal[] => {
      const egress = egressMap.get(artifactId);
      if (!egress) {
        return [];
      }
      const signals: UseCaseEgressSignal[] = [];
      if (egress.downloaded) {
        signals.push('downloaded');
      }
      if (egress.copied) {
        signals.push('copied');
      }
      if (egress.published) {
        signals.push('published');
      }
      return signals;
    };

    const countPutToWork = (artifacts: UseCaseArtifactQueryRow[]): number => {
      return artifacts.filter((artifact) => isPutToWork(egressMap.get(artifact.artifact_id))).length;
    };

    const chats: UseCaseChatRow[] = chatRows.map((row) => {
      const chatArtifacts = artifactsByChat.get(row.chat_id) ?? [];
      return {
        chatId: row.chat_id,
        title: row.title,
        ownerUserId: row.owner_user_id,
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
        cost: Number(row.cost ?? 0),
        artifacts: chatArtifacts.length,
        putToWork: countPutToWork(chatArtifacts),
        createdAt: row.created_at,
      };
    });

    // spendRows is grouped by (user, group), so someone who worked under two groups
    // has two rows. Spend accumulates; work products come from a per-user map and are
    // therefore set once, never per row.
    const peopleMap = new Map<string, UseCasePersonRow>();
    spendRows.forEach((row) => {
      const existing = peopleMap.get(row.user_id);
      if (existing) {
        existing.chats += Number(row.chats);
        existing.cost += Number(row.cost ?? 0);
        return;
      }
      const userArtifacts = artifactsByUser.get(row.user_id) ?? [];
      peopleMap.set(row.user_id, {
        userId: row.user_id,
        name: row.user_name,
        email: row.user_email,
        chats: Number(row.chats),
        cost: Number(row.cost ?? 0),
        artifacts: userArtifacts.length,
        putToWork: countPutToWork(userArtifacts),
      });
    });

    // Mirrors the teams pass below: someone whose work product is counted in the
    // header must appear here even with no usage row of their own. An artifact row
    // carries no name or email, which the people block already renders as Unknown.
    artifactsByUser.forEach((artifacts, ownerUserId) => {
      if (!peopleMap.has(ownerUserId)) {
        peopleMap.set(ownerUserId, {
          userId: ownerUserId,
          name: null,
          email: null,
          chats: 0,
          cost: 0,
          artifacts: artifacts.length,
          putToWork: countPutToWork(artifacts),
        });
      }
    });

    const people = Array.from(peopleMap.values()).sort((a, b) => b.cost - a.cost);

    // Spend attributes by usage row's group, work products by the chat's group.
    const teamsMap = new Map<string | null, UseCaseTeamRow>();
    spendRows.forEach((row) => {
      const existing = teamsMap.get(row.user_group_id);
      if (existing) {
        existing.chats += Number(row.chats);
        existing.cost += Number(row.cost ?? 0);
      } else {
        const groupArtifacts = artifactsByGroup.get(row.user_group_id) ?? [];
        teamsMap.set(row.user_group_id, {
          userGroupId: row.user_group_id,
          label: row.group_label ?? UNATTRIBUTED_TEAM_LABEL,
          chats: Number(row.chats),
          cost: Number(row.cost ?? 0),
          artifacts: groupArtifacts.length,
          putToWork: countPutToWork(groupArtifacts),
        });
      }
    });

    artifactsByGroup.forEach((artifacts, groupId) => {
      if (!teamsMap.has(groupId)) {
        teamsMap.set(groupId, {
          userGroupId: groupId,
          label: artifacts[0]?.group_label ?? UNATTRIBUTED_TEAM_LABEL,
          chats: 0,
          cost: 0,
          artifacts: artifacts.length,
          putToWork: countPutToWork(artifacts),
        });
      }
    });

    const teams = Array.from(teamsMap.values()).sort((a, b) => b.cost - a.cost);

    const weekly: UseCaseWeekPoint[] = weeklyRows.map((row) => {
      const categoryCost = Number(row.category_cost ?? 0);
      const chatCost = Number(row.chat_cost ?? 0);
      return {
        weekStart: row.week_start,
        cost: categoryCost,
        // A fraction, not a percentage: formatPercent() scales it, and the panel's
        // row share comes from rate(), so both sides of the drawer agree.
        shareOfChatSpend: chatCost > 0 ? categoryCost / chatCost : null,
      };
    });

    const artifactList: UseCaseArtifactRow[] = artifactRows.map((row) => ({
      artifactId: row.artifact_id,
      name: row.name,
      chatId: row.chat_id,
      signals: buildSignals(row.artifact_id),
    }));

    // spendRows already excludes unattributed rows, matching the weeklyRows/totalResult
    // exclusion above so the header stat agrees with the trend chart and total.
    const cost = spendRows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
    const artifacts = artifactRows.length;
    const putToWork = countPutToWork(artifactRows);
    const totalChats = Number(totalResult[0]?.total ?? 0);

    return {
      useCase,
      cost,
      artifacts,
      putToWork,
      totalChats,
      chats,
      people,
      teams,
      artifactList,
      weekly,
    };
  } catch (error) {
    logger.error('Failed to load Context Studio use case detail', { error });
    throw new Error('Failed to fetch use case detail');
  }
}
