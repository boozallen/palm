import crypto from 'crypto';
import db from '@/server/db';
import logger from '@/server/logger';
import { sanitizeForPostgres } from '@/features/workflows/utils/sanitize';
import { PrimitiveType, PromptConfig, PrimitiveConfig } from '@/features/workflows/types/primitive';

type CopyWorkflowInput = {
  workflowId: string;
  userId: string;
  userGroupIds: string[];
};

export type CopyWorkflowResult = {
  copiedWorkflowId: string;
  workflowName: string;
};

export default async function copyWorkflow(
  input: CopyWorkflowInput
): Promise<CopyWorkflowResult> {
  const { workflowId, userId, userGroupIds } = input;

  const result = await db.$transaction(async (prisma) => {
    const sourceWorkflow = await prisma.workflow.findUnique({
      where: { id: workflowId, deletedAt: null },
    });

    if (!sourceWorkflow) {
      throw new Error('Workflow not found');
    }

    const sourceDefinition = sourceWorkflow.definition as Record<string, unknown>;
    const sourcePrimitives = (sourceDefinition.primitives ?? []) as PrimitiveConfig[];

    const copiedPrimitives = await Promise.all(
      sourcePrimitives.map(async (primitive) => {
        if (primitive.type === PrimitiveType.DOCUMENT) {
          return {
            ...primitive,
            config: {},
          };
        }

        if (primitive.type === PrimitiveType.PROMPT) {
          const config = primitive.config as PromptConfig;

          let promptInstructions = config.prompt ?? '';
          if (config.promptId) {
            const sourcePrompt = await prisma.prompt.findUnique({
              where: { id: config.promptId },
            });
            if (sourcePrompt) {
              promptInstructions = sourcePrompt.instructions;
            }
          }

          if (!config.model && !config.promptId && !promptInstructions) {
            return primitive;
          }

          const newPrompt = await prisma.prompt.create({
            data: {
              title: 'Workflow Prompt',
              instructions: promptInstructions,
              model: config.model || '',
              temperature: config.temperature ?? 0.7,
              topP: 0.5,
              summary: '',
              description: '',
              example: '',
              workflows: true,
              creatorId: userId,
            },
            select: { id: true },
          });

          const newConfig: PromptConfig = {
            model: config.model || '',
            promptId: newPrompt.id,
            inputField: config.inputField,
            temperature: config.temperature,
            topP: config.topP,
            frequencyPenalty: config.frequencyPenalty,
            presencePenalty: config.presencePenalty,
            systemMessage: config.systemMessage,
            useGraph: config.useGraph,
          };

          return {
            ...primitive,
            config: newConfig,
          };
        }

        return primitive;
      }),
    );

    const copiedDefinition = {
      ...sourceDefinition,
      id: crypto.randomUUID(),
      primitives: copiedPrimitives,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const copiedWorkflow = await prisma.workflow.create({
      data: {
        name: `${sourceWorkflow.name} (Copy)`,
        description: sourceWorkflow.description,
        version: sourceWorkflow.version,
        definition: sanitizeForPostgres(copiedDefinition) as object,
        createdBy: userId,
        ...(userGroupIds.length > 0 && {
          userGroups: {
            connect: userGroupIds.map((id) => ({ id })),
          },
        }),
      },
    });

    logger.info(`User ${userId} copied workflow ${workflowId}, created copy ${copiedWorkflow.id}`);

    return {
      copiedWorkflowId: copiedWorkflow.id,
      workflowName: sourceWorkflow.name,
    };
  });

  return result;
}
