import db from '@/server/db';
import { deleteConversationNodesForChat } from '@/features/graph-database/dal/deleteConversationGraphNodes';
import { retryWithBackoff } from '@/features/graph-database/utils/retryWithBackoff';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import logger from '@/server/logger';

export default async function deleteChat(chatId: string, userId: string) {
  const isConversationGraphOn = await isMemoryEnabled();
  const cleanConversationGraph = () => isConversationGraphOn
    ? retryWithBackoff(() => deleteConversationNodesForChat(chatId, userId))
    : deleteConversationNodesForChat(chatId, userId);

  // Cleanup is unconditional so nodes from a previously enabled deployment
  // are not stranded. Deliberately, it blocks deletion only while the feature
  // is on: an unused or unavailable Neo4j must not break flag-off chat deletes.
  try {
    await cleanConversationGraph();
  } catch (error) {
    if (isConversationGraphOn) {
      throw error;
    }
    logger.warn('Could not clean conversation graph before deleting chat while feature is off', {
      chatId,
      error,
    });
  }

  // If this PostgreSQL delete fails after graph cleanup, the chat remains with
  // its graph nodes removed. Reprojection waits for reconciliation (#148) or a
  // later sync that happens to include the chat's message ids.

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

  // Close the race with a sync that committed after the first cleanup but
  // before PostgreSQL deletion made the chat unavailable to future syncs.
  try {
    await cleanConversationGraph();
  } catch (error) {
    // PostgreSQL deletion already succeeded, so surface the cleanup failure in
    // logs without incorrectly reporting that the user's deletion failed. The
    // flag controls severity for the same deliberate reason as the first pass.
    if (isConversationGraphOn) {
      logger.error('Error cleaning conversation graph after deleting chat', {
        chatId,
        error,
      });
    } else {
      logger.warn('Error cleaning conversation graph after deleting chat', {
        chatId,
        error,
      });
    }
  }
}
