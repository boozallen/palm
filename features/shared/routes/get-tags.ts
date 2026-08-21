import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import getTags from '@/features/shared/dal/getTags';

const inputSchema = z.object({
  query: z.string(),
});

const outputSchema = z.object({
  tags: z.array(z.string()),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (!ctx.userId) {
      throw Unauthorized('You do not have permission to access this resource');
    }

    const distinctTags = await getTags(input.query);

    const output: z.infer<typeof outputSchema> = {
      tags: distinctTags,
    };

    return output;
  });
