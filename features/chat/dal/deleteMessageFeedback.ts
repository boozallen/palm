import db from '@/server/db';
import logger from '@/server/logger';

export default async function deleteMessageFeedback(messageId: string): Promise<void> {
  try {
    await db.assistantChatMessageFeedback.deleteMany({
      where: { chatMessageId: messageId },
    });
  } catch (error) {
    logger.error(`Error deleting message feedback: MessageId: ${messageId}`, error);
    throw new Error('Error deleting message feedback');
  }
}
