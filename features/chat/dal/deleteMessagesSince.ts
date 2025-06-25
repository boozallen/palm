import db from '@/server/db';
import logger from '@/server/logger';

export default async function deleteMessagesSince(chatId: string, since: Date) {
  try {
    // this will delete all messages for a chat that were created since the given date
    await db.chatMessage.deleteMany({
      where: {
        chatId,
        createdAt: {
          gte: since,
        },
      },
    });
  } catch (error) {
    logger.error(`Error deleting messages from the database. ChatId: ${chatId}`, error);
    throw new Error('Error deleting messages');
  }
}
