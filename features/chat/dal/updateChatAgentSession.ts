import db from '@/server/db';
import logger from '@/server/logger';

type UpdateChatAgentSessionInput = {
  chatId: string;
  externalSessionId: string;
};

export default async function updateChatAgentSession(
  input: UpdateChatAgentSessionInput,
): Promise<void> {
  try {
    await db.chat.update({
      where: { id: input.chatId },
      data: { externalSessionId: input.externalSessionId },
    });
  } catch (error) {
    logger.error('Error updating chat agent session', error);
    throw new Error('Error updating chat agent session');
  }
}
