import { z } from 'zod';
import {
  inferProcedureInput,
  inferProcedureOutput,
} from '@trpc/server';
import { PromptUtils, PromptSchema } from '@/features/shared/types';
import { procedure } from '@/server/trpc';
import { Prisma } from '@prisma/client';
import { getPromptStats } from '@/features/library/dal/getPromptStats';
import logger from '@/server/logger';

const getPrompts = procedure
  .input(
    z.object({
      tabFilter: z.string().optional(),
      search: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
  )
  .output(
    z.object({
      prompts: z.array(
        PromptSchema.extend({
          id: z.string().uuid(),
        })
      ),
      stats: z.record(
        z.string(),
        z.object({
          bookmarkCount: z.number(),
          usageCount: z.number(),
        })
      ),
    })
  )
  .query(async ({ input, ctx }) => {
    const { search: searchTerm, tags, tabFilter } = input;
    const userId = ctx.userId;

    let tabFilterClause = {};
    let isPopularFilter = false;
    
    if (tabFilter === 'owned') {
      tabFilterClause = { creatorId: userId };
    } else if (tabFilter === 'bookmarked') {
      tabFilterClause = { bookmarks: { some: { userId: userId } } };
    } else if (tabFilter === 'popular') {
      isPopularFilter = true;
      // For popular filter, we'll handle sorting after fetching all prompts
    }

    const searchClause = searchTerm?.length
      ? {
        OR: [
          {
            title: {
              contains: searchTerm,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            summary: {
              contains: searchTerm,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            description: {
              contains: searchTerm,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      }
      : {};

    const tagsClause = tags?.length
      ? { AND: tags.map((tag) => ({ tags: { some: { tag } } })) }
      : {};

    const where = { workflows: false, ...tabFilterClause, ...searchClause, ...tagsClause };

    const findArgs = { include: { tags: true }, where };
    try {
      const dbPrompts = await ctx.prisma.prompt.findMany(findArgs);
      let prompts = dbPrompts.map(PromptUtils.unmarshal);
      
      // Fetch usage stats for all prompts
      const promptIds = prompts.map(p => p.id);
      const statsMap = await getPromptStats(ctx.prisma, promptIds);
      
      // If popular filter is selected, sort by popularity
      if (isPopularFilter) {
        // Sort by popularity (bookmarks + usage), highest first
        prompts = prompts.sort((a, b) => {
          const aStats = statsMap[a.id] || { bookmarkCount: 0, usageCount: 0 };
          const bStats = statsMap[b.id] || { bookmarkCount: 0, usageCount: 0 };
          const aPopularity = aStats.bookmarkCount + aStats.usageCount;
          const bPopularity = bStats.bookmarkCount + bStats.usageCount;
          return bPopularity - aPopularity;
        });
      }
      
      return { prompts, stats: statsMap };
    } catch (error) {
      logger.error('Error fetching prompts from database', error);
      throw new Error('Error fetching prompts');
    }
  });

export default getPrompts;

export type GetPromptsInput = inferProcedureInput<typeof getPrompts>;
export type GetPromptsOutput = inferProcedureOutput<typeof getPrompts>;
