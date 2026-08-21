import logger from '@/server/logger';
import db from '@/server/db';
import { Prisma } from '@prisma/client';
import {
  WorkflowArtifactSearchQuery,
  WorkflowArtifactSearchQueryResult,
} from '@/features/context-studio/types/chat-search';
import getWorkflowArtifactCosts from '@/features/context-studio/dal/getWorkflowArtifactCosts';

const DAYS_BY_RANGE = { week: 7, month: 30, year: 365 };

export default async function searchWorkflowArtifacts(
  query: WorkflowArtifactSearchQuery,
): Promise<WorkflowArtifactSearchQueryResult> {
  try {
    const { search, excludeAdmins, timeRange, userGroupId, userId, page, pageSize } = query;

    const whereClause: Prisma.WorkflowArtifactWhereInput = {};
    const executionWhere: Prisma.WorkflowExecutionWhereInput = {};

    if (timeRange && timeRange !== 'forever') {
      const daysAgo = new Date(Date.now() - DAYS_BY_RANGE[timeRange] * 24 * 60 * 60 * 1000);
      whereClause.createdAt = { gte: daysAgo };
    }

    if (userId && userId !== 'all') {
      executionWhere.triggeredBy = userId;
    } else if (userGroupId && userGroupId !== 'all') {
      executionWhere.user = { userGroupMemberhip: { some: { userGroupId } } };
    }

    if (excludeAdmins) {
      executionWhere.user = { ...executionWhere.user as object, role: { not: 'Admin' } };
    }

    if (Object.keys(executionWhere).length > 0) {
      whereClause.workflowExecution = executionWhere;
    }

    if (search) {
      whereClause.label = { contains: search, mode: 'insensitive' };
    }

    const [artifacts, totalCount] = await Promise.all([
      db.workflowArtifact.findMany({
        where: whereClause,
        select: {
          id: true,
          label: true,
          fileExtension: true,
          createdAt: true,
          workflowExecutionId: true,
          workflowExecution: {
            select: {
              user: { select: { name: true } },
              workflow: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.workflowArtifact.count({ where: whereClause }),
    ]);

    const costs = await getWorkflowArtifactCosts(
      Array.from(new Set(artifacts.map((a) => a.workflowExecutionId))),
    );

    const records = artifacts.map((art) => {
      const cost = costs.get(art.id);
      return {
        id: art.id,
        name: `${art.label}${art.fileExtension}`,
        workflowName: art.workflowExecution?.workflow?.name ?? null,
        userName: art.workflowExecution?.user?.name ?? null,
        createdAt: art.createdAt,
        cost: cost?.cost ?? null,
        tokens: cost?.tokens ?? null,
        cumulativeCost: cost?.cumulativeCost ?? null,
        cumulativeTokens: cost?.cumulativeTokens ?? null,
      };
    });

    return { records, totalCount };
  } catch (error) {
    logger.error('Failed to search workflow artifacts', error);
    throw new Error('Unable to search workflow artifacts');
  }
}
