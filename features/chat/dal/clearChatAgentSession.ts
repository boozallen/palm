import db from '@/server/db';
import logger from '@/server/logger';

export default async function clearChatAgentSession(chatId: string): Promise<void> {
  try {
    await db.chat.update({
      where: { id: chatId },
      data: { externalSessionId: null },
    });
  } catch (error) {
    logger.error('Error clearing chat agent session', error);
    throw new Error('Error clearing chat agent session');
  }
}
