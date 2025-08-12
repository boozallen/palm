import { Chat } from '@/features/chat/types/chat';
import logger from '@/server/logger';
import db from '@/server/db';

export default async function getChats(userId: string): Promise<Chat[]> {

  let results = null;
  try {
    results = await db.chat.findMany({
      where: {
        userId: userId,
      },
    });
  } catch (error) {
    logger.error('Error fetching chat records from the database.', error);
    throw new Error('Error fetching chat records');
  }

  if (!results) {
    logger.error('No chat records found in the database.');
    throw new Error('No chat records found');
  }

  return results.map((chat): Chat => ({
    id: chat.id,
    userId: userId,
    modelId: chat.modelId,
    promptId: chat.promptId,
    summary: chat.summary,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  }));
}
