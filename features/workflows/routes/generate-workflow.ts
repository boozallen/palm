import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import { PrimitiveType } from '@/features/workflows/types/primitive';
import generateWorkflow from '@/features/workflows/dal/generateWorkflow';

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
  }),
);

const inputSchema = z.object({
  description: z.string().min(1),
  documentIds: z.array(z.string()),
  currentWorkflow: z.array(primitiveConfigSchema).optional(),
});

const outputSchema = z.object({
  primitives: z.array(primitiveConfigSchema),
});

export const generateWorkflowRoute = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.userId) {
      throw Unauthorized('You do not have permission to access this resource');
    }

    const result = await generateWorkflow(ctx.ai, {
      description: input.description,
      documentIds: input.documentIds,
      userId: ctx.userId,
      currentWorkflow: input.currentWorkflow,
    });

    return { primitives: result.primitives };
  });
