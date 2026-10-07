import { z } from 'zod';
import {
  inferProcedureInput,
  inferProcedureOutput,
} from '@trpc/server';
import { procedure } from '@/server/trpc';
import { getPromptStats } from '../dal/getPromptStats';
import logger from '@/server/logger';

const getPromptStatsRoute = procedure
  .input(
    z.object({
      promptIds: z.array(z.string().uuid()),
    })
  )
  .output(
    z.record(
      z.string(),
      z.object({
        bookmarkCount: z.number(),
        usageCount: z.number(),
      })
    )
  )
  .query(async ({ input, ctx }) => {
    const { promptIds } = input;

    try {
      const stats = await getPromptStats(ctx.prisma, promptIds);
      return stats;
    } catch (error) {
      logger.error('Error fetching prompt statistics', error);
      throw new Error('Error fetching prompt statistics');
    }
  });

export default getPromptStatsRoute;

export type GetPromptStatsInput = inferProcedureInput<typeof getPromptStatsRoute>;
export type GetPromptStatsOutput = inferProcedureOutput<typeof getPromptStatsRoute>;