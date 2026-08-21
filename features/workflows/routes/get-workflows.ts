import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getWorkflowsFromDb from '@/features/workflows/dal/getWorkflows';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';

export const getWorkflows = procedure
  .input(
    z
      .object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        userGroupId: z.string().uuid().optional(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      throw Forbidden('You do not have access to workflows');
    }

    const limit = input?.limit ?? 20;
    const offset = input?.offset ?? 0;

    const { workflows, total } = await getWorkflowsFromDb(
      ctx.userId,
      limit,
      offset,
      input?.userGroupId
    );

    return {
      workflows: workflows.map((workflow: {
        id: string;
        name: string;
        description: string | null;
        version: string;
        definition: unknown;
        creator: { id: string; name: string; email: string | null };
        userGroups: unknown[];
        _count: { executions: number };
        createdAt: Date;
        updatedAt: Date;
      }) => {
        const definition = workflow.definition as any;
        return {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          version: workflow.version,
          primitiveCount: definition?.primitives?.length || 0,
          creator: workflow.creator,
          userGroups: workflow.userGroups,
          executionCount: workflow._count.executions,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
        };
      }),
      total,
      limit,
      offset,
    };
  });
