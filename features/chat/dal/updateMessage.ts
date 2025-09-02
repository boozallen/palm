import db from '@/server/db';
import logger from '@/server/logger';

type UpdateMessageInput = {
  messageId: string;
  content: string;
};

export default async function updateMessage(input: UpdateMessageInput): Promise<void> {
  try {
    await db.chatMessage.update({
      where: { id: input.messageId },
      data: { content: input.content },
    });
  } catch (error) {
    logger.error(`Error updating message: MessageId: ${input.messageId}`, error);
    throw new Error('Error updating message');
  }
}
