import { procedure } from '@/server/trpc';
import { z } from 'zod';
import logger from '@/server/logger';

const toggleBookmark = procedure
  .input(
    z.object({
      promptId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { promptId } = input;
    try {
      // check if the bookmark with the promptID already exist
      const existingBookmark = await ctx.prisma.promptBookmark.findFirst({
        where: {
          userId: ctx.userId,
          promptId,
        },
      });

      if (existingBookmark) {
        // if the bookmark exist delete it
        await ctx.prisma.promptBookmark.delete({
          where: {
            userId_promptId: {
              userId: ctx.userId,
              promptId,
            },
          },
        });
      } else {
        // if there are no records to delete - create a new bookmark record
        await ctx.prisma.promptBookmark.create({
          data: {
            userId: ctx.userId,
            promptId,
          },
        });
      }
    } catch (error) {
      logger.error(`Error toggling bookmark: promptId: ${promptId}`, error);
      throw new Error('Error toggling bookmark');
    }
  });

export default toggleBookmark;
