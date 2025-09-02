import { Chat } from '@/features/chat/types/chat';
import db from '@/server/db';
import logger from '@/server/logger';

type UpdateChatConversationSummaryInput = {
  id: string;
  summary: string | null;
};

export default async function updateChatConversationSummary(
  input: UpdateChatConversationSummaryInput
): Promise<Chat> {
  const chatConversationSummary = input.summary ?? `Chat - ${new Date().toUTCString()}`;

  try {
    const result = await db.chat.update({
      where: {
        id: input.id,
      },
      data: {
        summary: chatConversationSummary,
      },
    });

    return {
      id: result.id,
      summary: result.summary,
      userId: result.userId,
      modelId: result.modelId,
      promptId: result.promptId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  } catch (error) {
    logger.error(`Error updating chat conversation summary: ChatId: ${input.id}`, error);
    throw new Error('Error updating chat conversation summary');
  }
}
