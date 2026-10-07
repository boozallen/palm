import { getGraphDatabaseSource } from '@/features/graph-database';
import { RetryableError } from '@/features/ai-provider/sources/errors';
import type { GraphQueryResult } from '@/features/graph-database/sources/types';
import { logger } from '@/server/logger';

const DELETE_MESSAGES_FOR_CHAT_QUERY = `
  MATCH (m:Message {chatId: $chatId, userId: $userId})
  CALL {
    WITH m
    OPTIONAL MATCH (m)-[:PRODUCED]->(a:Artifact {userId: $userId})
    WITH m, collect(a) AS artifacts
    DETACH DELETE m
    WITH artifacts
    UNWIND artifacts AS a
    WITH DISTINCT a
    WHERE a IS NOT NULL
      AND NOT (:Message {userId: $userId})-[:PRODUCED]->(a)
    DETACH DELETE a
  } IN TRANSACTIONS OF 1000 ROWS
`;

const DELETE_MESSAGES_BY_ID_QUERY = `
  UNWIND $messageIds AS messageId
  MATCH (m:Message {id: messageId, userId: $userId})
  CALL {
    WITH m
    OPTIONAL MATCH (m)-[:PRODUCED]->(a:Artifact {userId: $userId})
    WITH m, collect(a) AS artifacts
    DETACH DELETE m
    WITH artifacts
    UNWIND artifacts AS a
    WITH DISTINCT a
    WHERE a IS NOT NULL
      AND NOT (:Message {userId: $userId})-[:PRODUCED]->(a)
    DETACH DELETE a
  } IN TRANSACTIONS OF 1000 ROWS
`;

const getNodesDeleted = (result: GraphQueryResult): number | undefined => (
  result.summary?.counters?.updates().nodesDeleted
);

export async function deleteConversationNodesForChat(
  chatId: string,
  userId: string,
): Promise<void> {
  try {
    const graphDb = await getGraphDatabaseSource();

    const messageResult = await graphDb.run(DELETE_MESSAGES_FOR_CHAT_QUERY, {
      chatId,
      userId,
    });
    const chatResult = await graphDb.run(
      'MATCH (c:Chat {id: $chatId, userId: $userId}) DETACH DELETE c',
      { chatId, userId },
    );
    if (getNodesDeleted(messageResult) === 0 && getNodesDeleted(chatResult) === 0) {
      logger.warn('Conversation graph chat delete matched no nodes', {
        chatId,
        userId,
      });
    }
  } catch (error) {
    logger.error('Error deleting conversation graph nodes for chat', {
      chatId,
      userId,
      error,
    });
    throw new RetryableError('Error deleting conversation graph nodes');
  }
}

export async function deleteConversationNodesForMessages(
  messageIds: string[],
  userId: string,
): Promise<void> {
  if (messageIds.length === 0) {
    return;
  }

  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(DELETE_MESSAGES_BY_ID_QUERY, {
      messageIds,
      userId,
    });
    if (getNodesDeleted(result) === 0) {
      logger.warn('Conversation graph message delete matched no nodes', {
        messageIds,
        userId,
      });
    }
  } catch (error) {
    logger.error('Error deleting conversation graph nodes for messages', {
      messageIds,
      userId,
      error,
    });
    throw new RetryableError('Error deleting conversation graph nodes');
  }
}
