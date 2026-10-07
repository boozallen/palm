import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getChatMetadata from '@/features/chat/dal/getChatMetadata';

const inputSchema = z.object({
  chatIds: z.array(z.string().uuid()),
});

const outputSchema = z.object({
  metadata: z.array(
    z.object({
      chatId: z.string().uuid(),
      modelName: z.string().nullable(),
      agentProviderName: z.string().nullable(),
      messageCount: z.number(),
      artifacts: z.array(
        z.object({
          id: z.string().uuid(),
          label: z.string(),
          fileExtension: z.string(),
        }),
      ),
    }),
  ),
});

export default procedure.input(inputSchema).output(outputSchema).query(async ({ input, ctx }) => {
  const metadata = await getChatMetadata(ctx.userId, input.chatIds);

  return { metadata };
});
