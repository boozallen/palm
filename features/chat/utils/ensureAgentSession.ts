import logger from '@/server/logger';
import { Chat } from '@/features/chat/types/chat';
import updateChatAgentSession from '@/features/chat/dal/updateChatAgentSession';

export default async function ensureAgentSession(
  chat: Chat,
  initialMessage: string,
  endpoint: string,
  apiKey?: string,
): Promise<string> {
  if (chat.externalSessionId) {
    return chat.externalSessionId;
  }

  if (!endpoint) {
    throw new Error('Agent endpoint is not configured');
  }

  try {
    logger.info('[ensureAgentSession] Creating session', { endpoint, messageLength: initialMessage.length });

    const response = await fetch(`${endpoint}/sessions/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
      },
      body: JSON.stringify({ idea: initialMessage, prd_path: '' }),
    });

    logger.info('[ensureAgentSession] Session create response', { status: response.status, statusText: response.statusText });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unable to read error body');
      logger.error('[ensureAgentSession] Session create failed', { status: response.status, body: errorBody });
      throw new Error(`Session create failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    const sessionId = responseData.session_id;

    if (!sessionId) {
      logger.error('[ensureAgentSession] No session_id in response', { responseData });
      throw new Error('No session_id in response');
    }

    logger.info('[ensureAgentSession] Session created', { sessionId });

    await updateChatAgentSession({
      chatId: chat.id,
      externalSessionId: sessionId,
    });

    return sessionId;
  } catch (error) {
    logger.error('Error creating external agent session', error);
    throw new Error('Error creating external agent session');
  }
}
