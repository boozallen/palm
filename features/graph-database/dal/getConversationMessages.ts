import db from '@/server/db';
import logger from '@/server/logger';

type GetConversationMessagesInput = {
  userId: string;
  chatId: string;
  startPosition?: number;
  endPosition?: number;
};

export default async function getConversationMessages({
  userId,
  chatId,
  startPosition,
  endPosition,
}: GetConversationMessagesInput) {
  let chat;
  try {
    chat = await db.chat.findFirst({
      where: {
        id: chatId,
        userId,
      },
      select: {
        id: true,
        summary: true,
      },
    });
  } catch (error) {
    logger.error('Error getting conversation messages', { userId, chatId, error });
    throw new Error('Error getting conversation messages');
  }

  if (!chat) {
    logger.warn('Conversation not found', { userId, chatId });
    throw new Error('Conversation not found');
  }

  try {
    const messageCount = await db.chatMessage.count({ where: { chatId } });
    if (messageCount === 0) {
      return {
        chatId: chat.id,
        title: chat.summary,
        messageCount,
        messages: [],
      };
    }

    const start = Math.min(Math.max(startPosition ?? 0, 0), messageCount);
    const end = Math.min(Math.max(endPosition ?? messageCount - 1, 0), messageCount - 1);
    if (start > end) {
      return {
        chatId: chat.id,
        title: chat.summary,
        messageCount,
        messages: [],
      };
    }

    const messageRows = await db.chatMessage.findMany({
      where: { chatId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: start,
      take: end - start + 1,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        chatArtifacts: {
          select: {
            id: true,
            label: true,
            fileExtension: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      chatId: chat.id,
      title: chat.summary,
      messageCount,
      messages: messageRows.map((message, index) => ({
        messageId: message.id,
        position: start + index,
        role: message.role,
        text: message.content,
        createdAt: message.createdAt,
        artifacts: message.chatArtifacts,
      })),
    };
  } catch (error) {
    logger.error('Error getting conversation messages', { userId, chatId, error });
    throw new Error('Error getting conversation messages');
  }
}
