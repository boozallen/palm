import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { PrimitiveFactory } from '@/features/workflows/primitives/PrimitiveFactory';
import updateWorkflowRecord from '@/features/workflows/dal/updateWorkflow';
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

export const updateWorkflow = procedure
  .input(
    z.object({
      workflowId: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      primitives: z.array(primitiveConfigSchema).min(1).optional(),
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

    // Validate primitives if provided
    if (input.primitives) {
      const validation = PrimitiveFactory.validateWorkflowPrimitives(
        input.primitives as unknown as PrimitiveConfig[]
      );

      if (!validation.valid) {
        throw new Error(`Invalid primitives: ${validation.errors?.join(', ')}`);
      }
    }

    const workflow = await updateWorkflowRecord({
      workflowId: input.workflowId,
      userId: ctx.userId,
      name: input.name,
      description: input.description,
      primitives: input.primitives as unknown as PrimitiveConfig[] | undefined,
      viewport: input.viewport,
      userGroupIds: input.userGroupIds,
    });

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      primitiveCount: input.primitives?.length || (workflow.definition as unknown as { primitives?: unknown[] })?.primitives?.length || 0,
      updatedAt: workflow.updatedAt,
    };
  });
