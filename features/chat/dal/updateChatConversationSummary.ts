import { Chat } from '@/features/chat/types/chat';
import db from '@/server/db';
import logger from '@/server/logger';

type UpdateChatConversationSummaryInput = {
  id: string;
  summary: string | null;
  useCase: string | null;
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
        // A null means the caller had no category to offer, not that the stored one
        // should go. Without this guard the title call, which always runs before the
        // reply lands, erases whatever the worker assigned.
        ...(input.useCase === null ? {} : { useCase: input.useCase }),
      },
    });

    return {
      id: result.id,
      summary: result.summary,
      useCase: result.useCase,
      userId: result.userId,
      modelId: result.modelId,
      promptId: result.promptId,
      agentProviderId: result.agentProviderId,
      externalSessionId: result.externalSessionId,
      userGroupId: result.userGroupId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  } catch (error) {
    logger.error(`Error updating chat conversation summary: ChatId: ${input.id}`, error);
    throw new Error('Error updating chat conversation summary');
  }
}
