import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';
import getChat from '@/features/chat/dal/getChat';
import deleteChat from '@/features/chat/dal/deleteChat';

const inputSchema = z.object({
  chatId: z.string().uuid(),
});

const outputSchema = z.object({
  chatId: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    // this will throw an error if the chat does not exist
    const chat = await getChat(input.chatId);

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      logger.error(`You do not have permission to delete this chat: userId: ${ctx.userId}, chatId: ${chat.id}`);
      throw Forbidden('You do not have permission to delete this chat');
    }

    await deleteChat(input.chatId);

    return {
      chatId: input.chatId,
    };
  });
