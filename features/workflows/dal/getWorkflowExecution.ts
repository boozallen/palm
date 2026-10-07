import db from '@/server/db';
import logger from '@/server/logger';

export default async function getWorkflowExecution(executionId: string, userId: string) {
  try {
    return await db.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        workflow: {
          include: {
            userGroups: {
              include: {
                userGroupMemberships: { where: { userId } },
              },
            },
          },
        },
        artifacts: {
          select: {
            id: true,
            githubPagesUrl: true,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching workflow execution:', error);
    throw new Error('Error fetching workflow execution');
  }
}
