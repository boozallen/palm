import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { PrimitiveFactory } from '@/features/workflows/primitives/PrimitiveFactory';
import createWorkflowRecord from '@/features/workflows/dal/createWorkflow';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import { PrimitiveConfig, PrimitiveType } from '@/features/workflows/types/primitive';

const primitiveConfigSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.nativeEnum(PrimitiveType),
    name: z.string(),
    config: z.record(z.any()),
    condition: z
      .object({
        field: z.string(),
        operator: z.enum([
          'equals',
          'not_equals',
          'contains',
          'greater_than',
          'less_than',
        ]),
        value: z.any(),
      })
      .optional(),
    predecessorIds: z.array(z.string()).optional(),
    position: z
      .object({
        x: z.number(),
        y: z.number(),
      })
      .optional(),
  })
);

export const createWorkflow = procedure
  .input(
    z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      primitives: z.array(primitiveConfigSchema).min(1),
      viewport: z.object({
        x: z.number(),
        y: z.number(),
        zoom: z.number(),
      }).optional(),
      userGroupIds: z.array(z.string().uuid()).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {

    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      throw Forbidden('You do not have access to workflows');
    }

    const validation = PrimitiveFactory.validateWorkflowPrimitives(
      input.primitives as unknown as PrimitiveConfig[]
    );

    if (!validation.valid) {
      throw new Error(`Invalid primitives: ${validation.errors?.join(', ')}`);
    }

    const workflow = await createWorkflowRecord({
      userId: ctx.userId,
      name: input.name,
      description: input.description,
      primitives: input.primitives as unknown as PrimitiveConfig[],
      viewport: input.viewport,
      userGroupIds: input.userGroupIds,
    });

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      primitiveCount: input.primitives.length,
      createdAt: workflow.createdAt,
    };
  });
