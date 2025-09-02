import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import getChat from '@/features/chat/dal/getChat';

const inputSchema = z.object({
  chatId: z.string().uuid(),
});

const outputSchema = z.object({
  chat: z.object({
    id: z.string().uuid(),
    modelId: z.string().nullable(),
    promptId: z.string().nullable(),
    summary: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { chatId } = input;

    const chat = await getChat(chatId);

    // perform an ownership check with the user's id
    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      logger.error(`You do not have permission to view this chat: userId: ${ctx.userId}, chatId: ${chat.id}`);
      throw new Error('You do not have permission to view this chat');
    }

    return {
      chat: {
        id: chat.id,
        userId: chat.userId,
        modelId: chat.modelId,
        promptId: chat.promptId,
        summary: chat.summary,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    };
  });
