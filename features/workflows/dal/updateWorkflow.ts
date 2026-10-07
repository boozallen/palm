import db from '@/server/db';
import logger from '@/server/logger';
import { sanitizeForPostgres } from '@/features/workflows/utils/sanitize';
import { PrimitiveConfig, PrimitiveType, PromptConfig } from '@/features/workflows/types/primitive';

export type UpdateWorkflowParams = {
  workflowId: string;
  userId: string;
  name?: string;
  description?: string | undefined;
  primitives?: PrimitiveConfig[];
  viewport?: { x: number; y: number; zoom: number };
  userGroupIds?: string[];
};

export default async function updateWorkflow(params: UpdateWorkflowParams) {
  const {
    workflowId,
    userId,
    name,
    description,
    primitives,
    viewport,
    userGroupIds,
  } = params;
  try {
    // First, verify the workflow exists and belongs to the user
    const existingWorkflow = await db.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!existingWorkflow) {
      throw new Error('Workflow not found');
    }

    if (existingWorkflow.createdBy !== userId) {
      throw new Error('You do not have permission to update this workflow');
    }

    const currentDefinition = existingWorkflow.definition as unknown as {
      primitives?: PrimitiveConfig[];
      [key: string]: unknown;
    };

    return await db.$transaction(async (tx) => {
      let primitivesToStore: PrimitiveConfig[] | undefined;
      if (primitives) {
        const oldPromptIds = (currentDefinition.primitives ?? [])
          .filter((p) => p.type === PrimitiveType.PROMPT)
          .map((p) => (p.config as PromptConfig).promptId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);

        primitivesToStore = primitives;

        const newPromptIds = primitivesToStore
          .filter((p) => p.type === PrimitiveType.PROMPT)
          .map((p) => (p.config as PromptConfig).promptId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        const orphanedIds = oldPromptIds.filter((id) => !newPromptIds.includes(id));
        if (orphanedIds.length > 0) {
          await tx.prompt.deleteMany({
            where: { id: { in: orphanedIds }, workflows: true },
          });
        }
      }

      // Build updated definition
      const updatedDefinition = {
        ...currentDefinition,
        ...(name !== undefined && { name }),
        ...('description' in params && { description }),
        ...(primitivesToStore !== undefined && { primitives: primitivesToStore }),
        ...(viewport && { viewport }),
        updatedAt: new Date(),
      };

      // Update the workflow
      return await tx.workflow.update({
        where: { id: workflowId },
        data: {
          ...(name !== undefined && { name }),
          ...('description' in params && { description }),
          definition: sanitizeForPostgres(updatedDefinition) as any,
          ...(userGroupIds && {
            userGroups: {
              set: [], // Clear existing
              connect: userGroupIds.map((id) => ({ id })),
            },
          }),
        },
        include: {
          userGroups: true,
        },
      });
    });
  } catch (error) {
    logger.error('Error updating workflow:', error);
    throw error;
  }
}
