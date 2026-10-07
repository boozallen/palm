import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import { AIFactory } from '@/features/ai-provider';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import getChat from '@/features/chat/dal/getChat';
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
  useCase: z.string().nullable(),
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
    let chatUseCase: string | null = null;

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

      // ctx.ai is built before this route knows which chat it's summarizing, so it
      // can't carry the chat's group — build a fresh factory scoped to it here.
      const chat = await getChat(input.chatId);
      const ai = new AIFactory({ userId: ctx.userId, userGroupId: chat.userGroupId ?? undefined });

      const response = await generateChatConversationSummary(ai, chatMessages);
      chatConversationSummary = response.summary;
      chatUseCase = response.useCase;
    }

    const updatedChat = await updateChatConversationSummary({
      id: input.chatId,
      summary: chatConversationSummary,
      useCase: chatUseCase,
    });

    const output: z.infer<typeof outputSchema> = {
      summary: updatedChat.summary,
      useCase: updatedChat.useCase,
    };

    return output;
  });
