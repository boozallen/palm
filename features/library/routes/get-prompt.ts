import { procedure } from '@/server/trpc';
import { z } from 'zod';
import { PromptSchema, PromptUtils } from '@/features/shared/types';
import {
  inferProcedureInput,
  inferProcedureOutput,
} from '@trpc/server';
import logger from '@/server/logger';

const getPrompt = procedure
  .input(
    z.object({
      promptId: z.string(),
    })
  )
  .output(
    z.object({
      prompt: PromptSchema.extend({
        id: z.string().uuid(),
      }),
    })
  )
  .query(async ({ input, ctx }) => {
    const { promptId: id } = input;
    try {
      const dbPrompt = await ctx.prisma.prompt.findUnique({
        where: { id },
        include: { tags: true },
      });
      if (!dbPrompt) {
        logger.error(`Prompt not found: id: ${id}`);
        throw new Error('Prompt not found');
      }
      return { prompt: PromptUtils.unmarshal(dbPrompt) };
    } catch (error) {
      logger.error(`Error fetching prompt from database: id: ${id}`, error);
      throw new Error('Error fetching prompt');
    }
  });

export default getPrompt;

export type GetPromptInput = inferProcedureInput<typeof getPrompt>;
export type GetPromptOutput = inferProcedureOutput<typeof getPrompt>;
