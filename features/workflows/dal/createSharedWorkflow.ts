import db from '@/server/db';
import { SharedWorkflow } from '@/features/workflows/types/shared-workflow';
import logger from '@/server/logger';

type CreateSharedWorkflowInput = {
  sourceWorkflowId: string;
  sourceUserId: string;
  sharedWithUserGroupIds: string[];
};

export default async function createSharedWorkflow(
  input: CreateSharedWorkflowInput
): Promise<SharedWorkflow> {
  try {
    const result = await db.sharedWorkflow.create({
      data: {
        sourceWorkflowId: input.sourceWorkflowId,
        sourceUserId: input.sourceUserId,
        sharedWithUserGroupIds: input.sharedWithUserGroupIds,
      },
    });

    return {
      id: result.id,
      sourceWorkflowId: result.sourceWorkflowId,
      sourceUserId: result.sourceUserId,
      sharedWithUserGroupIds: result.sharedWithUserGroupIds,
      createdAt: result.createdAt,
      deletedAt: result.deletedAt ?? undefined,
    };
  } catch (error) {
    logger.error(`Error creating shared workflow: WorkflowId: ${input.sourceWorkflowId}`, error);
    throw new Error('Error creating shared workflow');
  }
}
