import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { PrimitiveConfig, PrimitiveType, PromptConfig } from '@/features/workflows/types/primitive';
import deleteWorkflowPrompts from '@/features/workflows/dal/deleteWorkflowPrompts';

export default async function deleteWorkflow(
  workflowId: string,
  userId: string,
): Promise<{ id: string }> {
  try {
    const existingWorkflow = await db.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!existingWorkflow) {
      throw new Error('Workflow not found');
    }

    if (existingWorkflow.createdBy !== userId) {
      throw new Error('You do not have permission to delete this workflow');
    }

    const definition = existingWorkflow.definition as unknown as { primitives?: PrimitiveConfig[] };
    const promptIds = (definition.primitives ?? [])
      .filter((p) => p.type === PrimitiveType.PROMPT)
      .map((p) => (p.config as PromptConfig).promptId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    await deleteWorkflowPrompts(promptIds);

    const deletedWorkflow = await db.workflow.delete({
      where: { id: workflowId },
    });

    return { id: deletedWorkflow.id };
  } catch (error) {
    logger.error('Error deleting workflow:', error);
    throw new Error(handlePrismaError(error));
  }
}
