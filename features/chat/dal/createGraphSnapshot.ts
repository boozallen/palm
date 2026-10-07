import db from '@/server/db';
import logger from '@/server/logger';
import { GraphSnapshot } from '@/features/chat/types/message';

export type CreateGraphSnapshotInput = Readonly<{
  chatMessageId: string;
  nodeIds: string[];
  documentIds: string[];
  positions?: Record<string, { x: number; y: number }> | null;
}>;

export default async function createGraphSnapshot(
  input: CreateGraphSnapshotInput
): Promise<GraphSnapshot> {
  try {
    const created = await db.graphSnapshot.create({
      data: {
        chatMessageId: input.chatMessageId,
        nodeIds: input.nodeIds,
        documentIds: input.documentIds,
        positions: input.positions ?? undefined,
      },
    });

    return {
      id: created.id,
      chatMessageId: created.chatMessageId,
      nodeIds: created.nodeIds,
      documentIds: created.documentIds,
      positions: (created.positions as Record<string, { x: number; y: number }> | null) ?? null,
      createdAt: created.createdAt,
    };
  } catch (error) {
    logger.error('Error creating graph snapshot', { chatMessageId: input.chatMessageId, error });
    throw new Error('Error creating graph snapshot');
  }
}
