import { Chat } from '@/features/chat/types/chat';
import logger from '@/server/logger';
import db from '@/server/db';

export default async function getChat(chatId: string): Promise<Chat> {
  let results = null;
  try {
    results = await db.chat.findUnique({
      where: { id: chatId },
    });
  } catch (error) {
    logger.error(`Error fetching chat from the database. Id: ${chatId}`, error);
    throw new Error('Error fetching chat');
  }

  if (!results) {
    logger.error(`Chat not found in the database. Id: ${chatId}`);
    throw new Error('Chat not found');
  }

  return {
    id: results.id,
    userId: results.userId,
    modelId: results.modelId,
    promptId: results.promptId,
    summary: results.summary,
    createdAt: results.createdAt,
    updatedAt: results.updatedAt,
  };
}
