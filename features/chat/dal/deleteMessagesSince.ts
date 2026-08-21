import db from '@/server/db';
import { deleteConversationNodesForMessages } from '@/features/graph-database/dal/deleteConversationGraphNodes';
import { retryWithBackoff } from '@/features/graph-database/utils/retryWithBackoff';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import logger from '@/server/logger';

export default async function deleteMessagesSince(
  chatId: string,
  since: Date,
  userId: string,
) {
  let messageIds: string[];

  try {
    const messages = await db.chatMessage.findMany({
      where: {
        chatId,
        createdAt: {
          gte: since,
        },
      },
      select: {
        id: true,
      },
    });
    messageIds = messages.map(({ id }) => id);
  } catch (error) {
    logger.error(`Error finding messages to delete. ChatId: ${chatId}`, error);
    throw new Error('Error finding messages to delete');
  }

  const isConversationGraphOn = await isMemoryEnabled();
  const cleanConversationGraph = () => isConversationGraphOn
    ? retryWithBackoff(() => deleteConversationNodesForMessages(messageIds, userId))
    : deleteConversationNodesForMessages(messageIds, userId);

  // Cleanup is unconditional so nodes from a previously enabled deployment
  // are not stranded. Deliberately, it blocks deletion only while the feature
  // is on: an unused or unavailable Neo4j must not break flag-off deletions.
  try {
    await cleanConversationGraph();
  } catch (error) {
    if (isConversationGraphOn) {
      throw error;
    }
    logger.warn(
      'Could not clean conversation graph before deleting messages while feature is off',
      { chatId, messageIds, error },
    );
  }

  // If this PostgreSQL delete fails after graph cleanup, the messages remain
  // with their graph nodes removed. Reprojection waits for reconciliation
  // (#148) or a later sync that happens to include these message ids.

  try {
    // this will delete all messages for a chat that were created since the given date
    await db.chatMessage.deleteMany({
      where: {
        chatId,
        createdAt: {
          gte: since,
        },
      },
    });
  } catch (error) {
    logger.error(`Error deleting messages from the database. ChatId: ${chatId}`, error);
    throw new Error('Error deleting messages');
  }

  // Close the race with a sync that committed after the first cleanup but
  // before PostgreSQL deletion made these messages unavailable to future syncs.
  try {
    await cleanConversationGraph();
  } catch (error) {
    // PostgreSQL deletion already succeeded, so surface the cleanup failure in
    // logs without incorrectly reporting that the user's deletion failed. The
    // flag controls severity for the same deliberate reason as the first pass.
    if (isConversationGraphOn) {
      logger.error('Error cleaning conversation graph after deleting messages', {
        chatId,
        messageIds,
        error,
      });
    } else {
      logger.warn('Error cleaning conversation graph after deleting messages', {
        chatId,
        messageIds,
        error,
      });
    }
  }
}
