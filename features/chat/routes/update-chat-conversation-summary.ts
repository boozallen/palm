import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import getMessages from '@/features/chat/dal/getMessages';
import generateChatConversationSummary from '@/features/chat/system-ai/generateChatConversationSummary';
import updateChatConversationSummary from '@/features/chat/dal/updateChatConversationSummary';

const inputSchema = z.object({
  chatId: z.string().uuid(),
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.string(),
      messagedAt: z.string(),
    }),
  ).optional(),
});

const outputSchema = z.object({
  summary: z.string().nullable(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.userId) {
      throw Unauthorized('You do not have permission to access this resource');
    }

    const systemConfig = await getSystemConfig();

    let chatConversationSummary: string | null = null;

    // Generate an AI summary if feature is on
    if (systemConfig.featureManagementChatSummarization) {
      let chatMessages: { role: string, content: string, messagedAt: string }[];

      // Called in ChatForm after new Chat creation & first messages are added
      if (input.messages) {
        chatMessages = input.messages;
      }
      // Called in ChatHistoryNavLink if summary is an empty string
      else {
        const messages = await getMessages(input.chatId);
        chatMessages = messages.map((message) => {
          return {
            role: message.role,
            content: message.content,
            messagedAt: message.createdAt.toISOString(),
          };
        });
      }

      const response = await generateChatConversationSummary(ctx.ai, chatMessages);
      chatConversationSummary = response.summary;
    }

    const updatedChat = await updateChatConversationSummary({
      id: input.chatId,
      summary: chatConversationSummary,
    });

    const output: z.infer<typeof outputSchema> = {
      summary: updatedChat.summary,
    };

    return output;
  });
