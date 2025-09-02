import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import updateMessage from '@/features/chat/dal/updateMessage';

const inputSchema = z.object({
  messageId: z.string().uuid(),
  content: z.string().min(1),
});

const outputSchema = z.object({
  content: z.string(),
  chatMessageId: z.string().uuid(),
  chatId: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { messageId, content } = input;

    const message = await getMessage(messageId);
    const chat = await getChat(message.chatId);

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      ctx.logger.error(
        `You do not have permission to edit this message: userId: ${ctx.userId}, messageId: ${messageId}`
      );
      throw Forbidden('You do not have permission to edit this message');
    }

    await updateMessage({ messageId, content });

    return {
      content,
      chatMessageId: messageId,
      chatId: message.chatId,
    };
  });
