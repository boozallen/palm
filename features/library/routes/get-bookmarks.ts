import logger from '@/server/logger';
import { procedure } from '@/server/trpc';
import { z } from 'zod';

const outputSchema = z.object({
  bookmarkIds: z.array(z.string()),
});

const getBookmarks = procedure.output(outputSchema).query(async ({ ctx }) => {
  try {
    // get list of bookmarks from bookmarks table, use the context to set the user id
    const bookmarks = await ctx.prisma.promptBookmark.findMany({
      where: {
        userId: ctx.userId,
      },
    });

    // return only a list of prompt ids since user id is not needed
    return { bookmarkIds: bookmarks.map(({ promptId }) => promptId) };
  } catch (error) {
    logger.error('Error fetching bookmarks', error);
    throw new Error('Error fetching bookmarks');
  }
});

export default getBookmarks;
