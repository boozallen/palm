import db from '@/server/db';
import logger from '@/server/logger';
import { PrimitiveConfig, PrimitiveType, PromptConfig } from '@/features/workflows/types/primitive';

export default async function getWorkflow(workflowId: string, userId: string) {
  try {
    const result = await db.workflow.findUnique({
      where: { id: workflowId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        userGroups: {
          include: {
            userGroupMemberships: { where: { userId } },
          },
        },
        pinnedUserGroup: {
          select: {
            id: true,
            label: true,
            aiProviders: { select: { id: true } },
          },
        },
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            triggeredBy: true,
            artifacts: {
              select: {
                id: true,
                githubPagesUrl: true,
              },
            },
          },
        },
      },
    });

    if (!result) {
      return result;
    }

    const definition = result.definition as unknown as {
      primitives?: PrimitiveConfig[];
      [key: string]: unknown;
    };
    const primitivesList = definition.primitives ?? [];

    const resolvedPrimitives = await Promise.all(
      primitivesList.map(async (primitive) => {
        if (primitive.type !== PrimitiveType.PROMPT) {
          return primitive;
        }
        const config = primitive.config as PromptConfig;
        if (!config.promptId) {
          return primitive;
        }
        const prompt = await db.prompt.findUnique({
          where: { id: config.promptId },
          select: { instructions: true },
        });
        if (!prompt) {
          return primitive;
        }
        return {
          ...primitive,
          config: { ...config, promptText: prompt.instructions },
        };
      }),
    );

    return {
      ...result,
      definition: {
        ...definition,
        primitives: resolvedPrimitives,
      } as unknown as typeof result.definition,
    };
  } catch (error) {
    logger.error('Error fetching workflow:', error);
    throw new Error('Error fetching workflow');
  }
}
