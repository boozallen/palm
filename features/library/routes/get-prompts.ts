import { z } from 'zod';
import {
  inferProcedureInput,
  inferProcedureOutput,
} from '@trpc/server';
import { PromptUtils, PromptSchema } from '@/features/shared/types';
import { procedure } from '@/server/trpc';
import { Prisma } from '@prisma/client';
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
    })
  )
  .query(async ({ input, ctx }) => {
    const { search: searchTerm, tags, tabFilter } = input;
    const userId = ctx.userId;

    let tabFilterClause = {};
    if (tabFilter === 'owned') {
      tabFilterClause = { creatorId: userId };
    } else if (tabFilter === 'bookmarked') {
      tabFilterClause = { bookmarks: { some: { userId: userId } } };
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

    const where = { ...tabFilterClause, ...searchClause, ...tagsClause };

    const findArgs = { include: { tags: true }, where };
    try {
      const dbPrompts = await ctx.prisma.prompt.findMany(findArgs);
      const prompts = dbPrompts.map(PromptUtils.unmarshal);
      return { prompts };
    } catch (error) {
      logger.error('Error fetching prompts from database', error);
      throw new Error('Error fetching prompts');
    }
  });

export default getPrompts;

export type GetPromptsInput = inferProcedureInput<typeof getPrompts>;
export type GetPromptsOutput = inferProcedureOutput<typeof getPrompts>;
