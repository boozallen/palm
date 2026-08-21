import db from '@/server/db';
import logger from '@/server/logger';

export type GraphSnapshotMetadata = {
  snapshotId: string;
  documentIds: string[];
  chatUserId: string;
};

export default async function getGraphSnapshotMetadata(
  snapshotId: string,
): Promise<GraphSnapshotMetadata | null> {
  try {
    const snapshot = await db.graphSnapshot.findUnique({
      where: { id: snapshotId },
      select: {
        id: true,
        documentIds: true,
        message: { select: { chat: { select: { userId: true } } } },
      },
    });

    if (!snapshot) {
      return null;
    }

    return {
      snapshotId: snapshot.id,
      documentIds: snapshot.documentIds,
      chatUserId: snapshot.message.chat.userId,
    };
  } catch (error) {
    logger.error('Error loading graph snapshot metadata', { snapshotId, error });
    throw new Error('Error loading graph snapshot metadata');
  }
}
