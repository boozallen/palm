import db from '@/server/db';
import logger from '@/server/logger';
import { AsyncChatStatus } from '@/features/chat/types/message';

export default async function cancelChatMessage(messageId: string): Promise<void> {
  try {
    await db.chatMessage.update({
      where: { id: messageId },
      data: { asyncChatStatus: AsyncChatStatus.CANCELLED },
    });
  } catch (error) {
    logger.error(`Error cancelling chat message: MessageId: ${messageId}`, error);
    throw new Error('Error cancelling chat message');
  }
}
