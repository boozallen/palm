import db from '@/server/db';
import logger from '@/server/logger';

export default async function deleteMessage(messageId: string) {
  try {
    // this will delete the message from the database; it will
    // also delete any associated records because of the onDelete: CASCADE in the schema
    db.chatMessage.delete({
      where: {
        id: messageId,
      },
    });
  } catch (error) {
    logger.error(`Error deleting message from the database. Id: ${messageId}`, error);
    throw new Error('Error deleting message');
  }
}
