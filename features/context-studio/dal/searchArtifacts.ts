import logger from '@/server/logger';
import db from '@/server/db';
import { Prisma } from '@prisma/client';
import { ArtifactSearchQuery, ArtifactSearchQueryResult, ArtifactSearchResult } from '@/features/context-studio/types/artifact-search';
import getChatArtifactCosts from '@/features/context-studio/dal/getChatArtifactCosts';
import getWorkflowArtifactCosts from '@/features/context-studio/dal/getWorkflowArtifactCosts';
import getArtifactSizes from '@/features/context-studio/dal/getArtifactSizes';

const DAYS_BY_RANGE = { week: 7, month: 30, year: 365 };

type Candidate = {
  source: 'chat' | 'workflow';
  id: string;
  createdAt: Date;
  name: string;
  userName: string | null;
  workflowName: string | null;
  chatId?: string;
  workflowExecutionId?: string;
};

export default async function searchArtifacts(
  query: ArtifactSearchQuery,
): Promise<ArtifactSearchQueryResult> {
  try {
    const { search, source, fileType, excludeAdmins, timeRange, userGroupId, userId, page, pageSize } = query;

    // Built the same way searchChats/searchWorkflowArtifacts filter their own
    // Chat/WorkflowExecution where clauses, then nested once below — avoids
    // threading partial nested objects through each branch by hand.
    const chatFilter: Prisma.ChatWhereInput = {};
    const executionFilter: Prisma.WorkflowExecutionWhereInput = {};
    const workflowArtifactDateFilter: Prisma.WorkflowArtifactWhereInput = {};

    if (timeRange && timeRange !== 'forever') {
      const daysAgo = new Date(Date.now() - DAYS_BY_RANGE[timeRange] * 24 * 60 * 60 * 1000);
      // A chat artifact's relevant date is the conversation it belongs to —
      // matching searchChats, which filters the same way — not the artifact's
      // own createdAt. Workflow artifacts use their own createdAt, matching
      // searchWorkflowArtifacts.
      chatFilter.createdAt = { gte: daysAgo };
      workflowArtifactDateFilter.createdAt = { gte: daysAgo };
    }

    if (userId && userId !== 'all') {
      chatFilter.userId = userId;
      executionFilter.triggeredBy = userId;
    } else if (userGroupId && userGroupId !== 'all') {
      chatFilter.user = { userGroupMemberhip: { some: { userGroupId } } };
      executionFilter.user = { userGroupMemberhip: { some: { userGroupId } } };
    }

    if (excludeAdmins) {
      chatFilter.user = { ...chatFilter.user as object, role: { not: 'Admin' } };
      executionFilter.user = { ...executionFilter.user as object, role: { not: 'Admin' } };
    }

    const chatBaseWhere: Prisma.ChatArtifactWhereInput = Object.keys(chatFilter).length > 0
      ? { message: { chat: chatFilter } }
      : {};
    const workflowBaseWhere: Prisma.WorkflowArtifactWhereInput = {
      ...workflowArtifactDateFilter,
      ...(Object.keys(executionFilter).length > 0 ? { workflowExecution: executionFilter } : {}),
    };

    const chatWhere: Prisma.ChatArtifactWhereInput = { ...chatBaseWhere };
    const workflowWhere: Prisma.WorkflowArtifactWhereInput = { ...workflowBaseWhere };

    if (search) {
      chatWhere.OR = [
        { label: { contains: search, mode: 'insensitive' } },
        { fileExtension: { contains: search, mode: 'insensitive' } },
        { message: { chat: { user: { name: { contains: search, mode: 'insensitive' } } } } },
      ];
      workflowWhere.OR = [
        { label: { contains: search, mode: 'insensitive' } },
        { fileExtension: { contains: search, mode: 'insensitive' } },
        { workflowExecution: { user: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (fileType) {
      chatWhere.fileExtension = fileType;
      workflowWhere.fileExtension = fileType;
    }

    const includeChat = source !== 'workflow';
    const includeWorkflow = source !== 'chat';

    // Over-fetching `limit` (= skip + pageSize) sorted candidates from EACH
    // source is sufficient to guarantee a correct merged page: dropping the
    // other source's rows can only lower an item's rank within its own list,
    // so any item that belongs in the true top `limit` of the union is also
    // in the top `limit` of its own source alone.
    const limit = page * pageSize;

    const [chatCandidateRows, chatTotal, workflowCandidateRows, workflowTotal, chatTypeCounts, workflowTypeCounts] = await Promise.all([
      includeChat
        ? db.chatArtifact.findMany({
          where: chatWhere,
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            label: true,
            fileExtension: true,
            createdAt: true,
            message: { select: { chatId: true, chat: { select: { user: { select: { name: true } } } } } },
          },
        })
        : Promise.resolve([]),
      includeChat ? db.chatArtifact.count({ where: chatWhere }) : Promise.resolve(0),
      includeWorkflow
        ? db.workflowArtifact.findMany({
          where: workflowWhere,
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            label: true,
            fileExtension: true,
            createdAt: true,
            workflowExecutionId: true,
            workflowExecution: { select: { user: { select: { name: true } }, workflow: { select: { name: true } } } },
          },
        })
        : Promise.resolve([]),
      includeWorkflow ? db.workflowArtifact.count({ where: workflowWhere }) : Promise.resolve(0),
      db.chatArtifact.groupBy({ by: ['fileExtension'], where: chatBaseWhere, _count: true }),
      db.workflowArtifact.groupBy({ by: ['fileExtension'], where: workflowBaseWhere, _count: true }),
    ]);

    const totalCount = chatTotal + workflowTotal;

    const chatCandidates: Candidate[] = chatCandidateRows.map((c) => ({
      source: 'chat',
      id: c.id,
      createdAt: c.createdAt,
      name: `${c.label}${c.fileExtension}`,
      userName: c.message.chat.user?.name ?? null,
      workflowName: null,
      chatId: c.message.chatId,
    }));
    const workflowCandidates: Candidate[] = workflowCandidateRows.map((w) => ({
      source: 'workflow',
      id: w.id,
      createdAt: w.createdAt,
      name: `${w.label}${w.fileExtension}`,
      userName: w.workflowExecution?.user?.name ?? null,
      workflowName: w.workflowExecution?.workflow?.name ?? null,
      workflowExecutionId: w.workflowExecutionId,
    }));

    const merged = [...chatCandidates, ...workflowCandidates]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const skip = (page - 1) * pageSize;
    const pageSlice = merged.slice(skip, skip + pageSize);

    // Cost computation is expensive (per-chat/execution cumulative spend), so
    // it only ever runs for the artifacts actually on this page.
    const chatIdsOnPage = Array.from(new Set(
      pageSlice.filter((r) => r.source === 'chat').map((r) => r.chatId as string),
    ));
    const workflowExecutionIdsOnPage = Array.from(new Set(
      pageSlice.filter((r) => r.source === 'workflow').map((r) => r.workflowExecutionId as string),
    ));

    const chatArtifactIdsOnPage = pageSlice.filter((r) => r.source === 'chat').map((r) => r.id);
    const workflowArtifactIdsOnPage = pageSlice.filter((r) => r.source === 'workflow').map((r) => r.id);

    const [chatCostMap, workflowCostMap, sizeMap] = await Promise.all([
      getChatArtifactCosts(chatIdsOnPage, userGroupId),
      getWorkflowArtifactCosts(workflowExecutionIdsOnPage, userGroupId),
      getArtifactSizes(chatArtifactIdsOnPage, workflowArtifactIdsOnPage),
    ]);

    const records: ArtifactSearchResult[] = pageSlice.map((r) => {
      const cost = r.source === 'chat' ? chatCostMap.get(r.id) : workflowCostMap.get(r.id);
      return {
        id: r.id,
        name: r.name,
        source: r.source,
        userName: r.userName,
        workflowName: r.workflowName,
        createdAt: r.createdAt,
        cost: cost?.cost ?? null,
        tokens: cost?.tokens ?? null,
        cumulativeCost: cost?.cumulativeCost ?? null,
        cumulativeTokens: cost?.cumulativeTokens ?? null,
        sizeBytes: sizeMap.get(r.id) ?? null,
      };
    });

    const typeCounts: Record<string, number> = {};
    for (const g of chatTypeCounts) {
      typeCounts[g.fileExtension] = (typeCounts[g.fileExtension] ?? 0) + g._count;
    }
    for (const g of workflowTypeCounts) {
      typeCounts[g.fileExtension] = (typeCounts[g.fileExtension] ?? 0) + g._count;
    }

    return { records, totalCount, typeCounts };
  } catch (error) {
    logger.error('Failed to search artifacts', error);
    throw new Error('Unable to search artifacts');
  }
}
