import db from '@/server/db';
import logger from '@/server/logger';
import { WorkflowStatus } from '@/features/workflows/types/workflow';

export default async function createWorkflowExecution(
  executionId: string,
  workflowId: string,
  userId: string,
  input: Record<string, any>
) {
  try {
    return await db.workflowExecution.create({
      data: {
        id: executionId,
        workflowId,
        status: WorkflowStatus.PENDING,
        triggeredBy: userId,
        input,
        trace: [],
      },
    });
  } catch (error) {
    logger.error('Error creating workflow execution:', error);
    throw new Error(
      `Failed to save execution: ${error instanceof Error ? error.message : 'Database error'}`
    );
  }
}
