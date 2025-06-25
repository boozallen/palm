import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import getChat from '@/features/chat/dal/getChat';
import getMessages from '@/features/chat/dal/getMessages';

const inputSchema = z.object({
  chatId: z.string().uuid(),
});

const outputSchema = z.object({
  chatId: z.string().uuid(),
  messages: z.array(z.object({
    id: z.string().uuid(),
    role: z.string(),
    content: z.string(),
    messagedAt: z.date(),
    citations: z.array(z.object({
      knowledgeBaseLabel: z.string(),
      citation: z.string(),
    })),
    artifacts: z.array(z.object({
      id: z.string().uuid(),
      chatMessageId: z.string().uuid(),
      label: z.string(),
      content: z.string(),
      fileExtension: z.string(),
      createdAt: z.date(),
    })),
  })),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { chatId } = input;

    const chat = await getChat(chatId);

    // perform an ownership check with the user's id
    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      logger.error(`You do not have permission to view messages from this chat: userId: ${ctx.userId}, chatId: ${chat.id}`);
      throw new Error('You do not have permission to view messages from this chat');
    }

    const messages = await getMessages(chatId);
    return {
      chatId,
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messagedAt: msg.createdAt,
        citations: msg.citations,
        artifacts: msg.artifacts,
      })),
    };
  });
