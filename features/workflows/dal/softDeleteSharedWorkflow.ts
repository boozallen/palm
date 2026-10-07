import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

export type SoftDeleteSharedWorkflowInput = {
  sourceWorkflowId: string;
  sourceUserId: string;
};

/**
 * Soft deletes shared workflows by setting deletedAt timestamp.
 * This preserves the SharedWorkflow record and all associated SharedWorkflowAction records
 * for audit/history purposes while effectively "expiring" the share.
 */
export default async function softDeleteSharedWorkflow(
  input: SoftDeleteSharedWorkflowInput
): Promise<void> {
  try {
    await db.sharedWorkflow.updateMany({
      where: {
        sourceWorkflowId: input.sourceWorkflowId,
        sourceUserId: input.sourceUserId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to soft delete shared workflow', {
      error: error instanceof Error ? error.message : String(error),
      sourceWorkflowId: input.sourceWorkflowId,
      sourceUserId: input.sourceUserId,
    });
    throw new Error(handlePrismaError(error as Error));
  }
}
