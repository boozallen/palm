import { Prisma } from '@prisma/client';
import db from '@/server/db';
import logger from '@/server/logger';

export default async function getWorkflows(
  userId: string,
  limit: number,
  offset: number,
  userGroupId?: string
) {
  const where: Prisma.WorkflowWhereInput = {
    deletedAt: null,
    createdBy: userId,
  };

  if (userGroupId) {
    where.userGroups = { some: { id: userGroupId } };
  }

  try {
    const [workflows, total] = await Promise.all([
      db.workflow.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          userGroups: { select: { id: true, label: true } },
          _count: { select: { executions: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.workflow.count({ where }),
    ]);

    return { workflows, total };
  } catch (error) {
    logger.error('Error listing workflows:', error);
    throw new Error('Error listing workflows');
  }
}
