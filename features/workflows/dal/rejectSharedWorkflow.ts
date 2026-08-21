import db from '@/server/db';
import { SharedWorkflowAction, SharedWorkflowActionStatus } from '@/features/workflows/types/shared-workflow';
import logger from '@/server/logger';

type RejectSharedWorkflowInput = {
  sharedWorkflowId: string;
  userId: string;
  userGroupIds: string[];
};

export type RejectSharedWorkflowResult = {
  action: SharedWorkflowAction;
};

export default async function rejectSharedWorkflow(
  input: RejectSharedWorkflowInput
): Promise<RejectSharedWorkflowResult> {
  const { sharedWorkflowId, userId, userGroupIds } = input;

  const result = await db.$transaction(async (prisma) => {
    const sharedWorkflow = await prisma.sharedWorkflow.findUnique({
      where: { id: sharedWorkflowId },
    });

    if (!sharedWorkflow) {
      throw new Error('Shared workflow not found');
    }

    if (sharedWorkflow.deletedAt) {
      throw new Error('This share has expired');
    }

    const hasAccess = sharedWorkflow.sharedWithUserGroupIds.some(
      (groupId) => userGroupIds.includes(groupId)
    );

    if (!hasAccess) {
      throw new Error('You do not have access to this shared workflow');
    }

    const action = await prisma.sharedWorkflowAction.create({
      data: {
        sharedWorkflowId,
        userId,
        status: SharedWorkflowActionStatus.Rejected,
      },
    });

    logger.info(`User ${userId} rejected shared workflow ${sharedWorkflowId}`);

    return {
      action: {
        id: action.id,
        sharedWorkflowId: action.sharedWorkflowId,
        copiedWorkflowId: action.copiedWorkflowId ?? undefined,
        userId: action.userId,
        status: action.status as SharedWorkflowActionStatus,
        createdAt: action.createdAt,
      },
    };
  });

  return result;
}
