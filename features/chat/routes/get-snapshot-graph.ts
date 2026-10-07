import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getSnapshotGraph from '@/features/chat/dal/getSnapshotGraph';
import getGraphSnapshotMetadata from '@/features/chat/dal/getGraphSnapshotMetadata';
import assertDocumentAccess from '@/features/shared/utils/assertDocumentAccess';
import { NotFound } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  snapshotId: z.string().uuid(),
});

const nodeSchema = z.object({
  id: z.number(),
  label: z.string(),
  labels: z.array(z.string()),
  properties: z.record(z.any()),
  group: z.string(),
  isAnchor: z.boolean(),
});

const edgeSchema = z.object({
  from: z.number(),
  to: z.number(),
  label: z.string(),
  type: z.string(),
  properties: z.record(z.any()),
  isShortestPath: z.boolean(),
});

const outputSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  metadata: z.object({
    nodeCount: z.number(),
    edgeCount: z.number(),
    documentIds: z.array(z.string()),
    nodeIds: z.array(z.string()),
  }),
  snapshot: z.object({
    id: z.string().uuid(),
    chatMessageId: z.string().uuid(),
    nodeIds: z.array(z.string()),
    documentIds: z.array(z.string()),
    positions: z
      .record(z.object({ x: z.number(), y: z.number() }))
      .nullable(),
    createdAt: z.date(),
    questionContent: z.string(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const metadata = await getGraphSnapshotMetadata(input.snapshotId);
    if (!metadata || metadata.chatUserId !== ctx.userId) {
      throw NotFound('Snapshot not found');
    }

    const accessibleDocIds = await assertDocumentAccess(ctx, metadata.documentIds);

    return await getSnapshotGraph({
      snapshotId: input.snapshotId,
      accessibleDocIds,
    });
  });
