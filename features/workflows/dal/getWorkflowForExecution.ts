import db from '@/server/db';
import logger from '@/server/logger';

export default async function getWorkflowForExecution(workflowId: string, userId: string) {
  try {
    return await db.workflow.findUnique({
      where: { id: workflowId },
      include: {
        creator: true,
        userGroups: {
          include: {
            userGroupMemberships: { where: { userId } },
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching workflow for execution:', error);
    throw new Error('Error fetching workflow');
  }
}
