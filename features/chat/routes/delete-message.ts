import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';
import getChat from '@/features/chat/dal/getChat';
import getMessage from '@/features/chat/dal/getMessage';
import deleteMessagesSince from '@/features/chat/dal/deleteMessagesSince';

const inputSchema = z.object({
  chatId: z.string().uuid(),
  messageId: z.string().uuid(),
});

const outputSchema = z.object({
  messageId: z.string().uuid(),
  messagedAt: z.date(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    // this will throw an error if the chat does not exist
    const chat = await getChat(input.chatId);

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      logger.error(`You do not have permission to use this chat: userId: ${ctx.userId}, chatId: ${chat.id}`);
      throw Forbidden('You do not have permission to use this chat');
    }

    // this will throw an error if the message does not exist
    const message = await getMessage(input.messageId);

    if (message.chatId !== input.chatId) {
      logger.error(`Message does not belong to this chat: messageId: ${message.id}, chatId: ${message.chatId}`);
      throw BadRequest('Message does not belong to chat');
    }

    // remove all messages since the message to be deleted
    await deleteMessagesSince(input.chatId, message.createdAt);

    return {
      messageId: input.messageId,
      messagedAt: message.createdAt,
    };
  });
