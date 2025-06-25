import db from '@/server/db';
import logger from '@/server/logger';

export default async function deleteChat(chatId: string) {
  try {
    await db.chat.delete({
      where: {
        id: chatId,
      },
    });
  } catch (error) {
    logger.error(`Error deleting chat from the database. Id: ${chatId}`, error);
    throw new Error('Error deleting chat');
  }
}
