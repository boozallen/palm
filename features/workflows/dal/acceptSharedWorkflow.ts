import crypto from 'crypto';
import db from '@/server/db';
import { SharedWorkflowAction, SharedWorkflowActionStatus } from '@/features/workflows/types/shared-workflow';
import logger from '@/server/logger';
import { getSharedWorkflowExpirationDate } from '@/features/shared/utils/dateUtils';
import { sanitizeForPostgres } from '@/features/workflows/utils/sanitize';
import { PrimitiveType, PromptConfig, PrimitiveConfig } from '@/features/workflows/types/primitive';

type AcceptSharedWorkflowInput = {
  sharedWorkflowId: string;
  userId: string;
  userGroupIds: string[];
};

export type AcceptSharedWorkflowResult = {
  action: SharedWorkflowAction;
  workflowName: string;
};

export default async function acceptSharedWorkflow(
  input: AcceptSharedWorkflowInput
): Promise<AcceptSharedWorkflowResult> {
  const { sharedWorkflowId, userId, userGroupIds } = input;

  const result = await db.$transaction(async (prisma) => {
    const sharedWorkflow = await prisma.sharedWorkflow.findUnique({
      where: { id: sharedWorkflowId },
      include: {
        sourceWorkflow: true,
      },
    });

    if (!sharedWorkflow) {
      throw new Error('Shared workflow not found');
    }

    const expirationDate = getSharedWorkflowExpirationDate();

    if (sharedWorkflow.deletedAt || sharedWorkflow.createdAt <= expirationDate) {
      throw new Error('This share has expired');
    }

    const hasAccess = sharedWorkflow.sharedWithUserGroupIds.some(
      (groupId) => userGroupIds.includes(groupId)
    );

    if (!hasAccess) {
      throw new Error('You do not have access to this shared workflow');
    }

    const sourceWorkflow = sharedWorkflow.sourceWorkflow;
    const sourceDefinition = sourceWorkflow.definition as Record<string, unknown>;
    const sourcePrimitives = (sourceDefinition.primitives ?? []) as PrimitiveConfig[];

    // Copy primitives: create new prompts for LLM primitives, clear document input preselections
    const copiedPrimitives = await Promise.all(
      sourcePrimitives.map(async (primitive) => {
        if (primitive.type === PrimitiveType.DOCUMENT) {
          // Clear document preselections
          return {
            ...primitive,
            config: {},
          };
        }

        if (primitive.type === PrimitiveType.PROMPT) {
          const config = primitive.config as PromptConfig;

          // Fetch the source prompt to copy its instructions
          let promptInstructions = config.prompt ?? '';
          if (config.promptId) {
            const sourcePrompt = await prisma.prompt.findUnique({
              where: { id: config.promptId },
            });
            if (sourcePrompt) {
              promptInstructions = sourcePrompt.instructions;
            }
          }

          // Only create a new prompt if there is something to copy
          if (!config.model && !config.promptId && !promptInstructions) {
            return primitive;
          }

          // Create a new prompt owned by the accepting user
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

    // Create the copied workflow
    const copiedWorkflow = await prisma.workflow.create({
      data: {
        name: sourceWorkflow.name,
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

    // Create the action record
    const action = await prisma.sharedWorkflowAction.create({
      data: {
        sharedWorkflowId,
        userId,
        status: SharedWorkflowActionStatus.Accepted,
        copiedWorkflowId: copiedWorkflow.id,
      },
    });

    logger.info(`User ${userId} accepted shared workflow ${sharedWorkflowId}, created copy ${copiedWorkflow.id}`);

    return {
      action: {
        id: action.id,
        sharedWorkflowId: action.sharedWorkflowId,
        copiedWorkflowId: action.copiedWorkflowId ?? undefined,
        userId: action.userId,
        status: action.status as SharedWorkflowActionStatus,
        createdAt: action.createdAt,
      },
      workflowName: sourceWorkflow.name,
    };
  });

  return result;
}
