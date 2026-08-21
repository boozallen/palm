import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import { PrimitiveType } from '@/features/workflows/types/primitive';
import planWorkflowConversational from '@/features/workflows/dal/planWorkflowConversational';

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

const conversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const availableModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerLabel: z.string(),
  aiProviderTypeId: z.number(),
});

const inputSchema = z.object({
  userMessage: z.string().min(1),
  documentIds: z.array(z.string()),
  conversationHistory: z.array(conversationMessageSchema),
  currentWorkflow: z.array(primitiveConfigSchema).optional(),
  availableModels: z.array(availableModelSchema).optional(),
});

const conversationalResponseSchema = z.object({
  type: z.literal('conversation'),
  message: z.string(),
  isReadyToGenerate: z.boolean(),
});

const generatedResponseSchema = z.object({
  type: z.literal('generated'),
  primitives: z.array(primitiveConfigSchema),
  message: z.string(),
});

const outputSchema = z.union([conversationalResponseSchema, generatedResponseSchema]);

export const planWorkflowConversationalRoute = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.userId) {
      throw Unauthorized('You do not have permission to access this resource');
    }

    const result = await planWorkflowConversational(ctx.ai, {
      userMessage: input.userMessage,
      documentIds: input.documentIds,
      userId: ctx.userId,
      conversationHistory: input.conversationHistory,
      currentWorkflow: input.currentWorkflow,
      availableModels: input.availableModels || [],
    });

    return result;
  });
