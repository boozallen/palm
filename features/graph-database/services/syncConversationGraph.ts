import { Prisma } from '@prisma/client';

import { getGraphDatabaseSource } from '@/features/graph-database';
import {
  CONVERSATION_SIDECAR_EMBED_BATCH_SIZE,
  CONVERSATION_SIDECAR_EMBED_MAX_CHARS,
} from '@/features/graph-database/config/conversation-graph.config';
import type { GraphTransaction } from '@/features/graph-database/sources/types';
import { retryWithBackoff } from '@/features/graph-database/utils/retryWithBackoff';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import type { ConversationGraphSyncJobData } from '@/features/graph-database/utils/worker/conversationGraphQueue';
import db from '@/server/db';
import { logger } from '@/server/logger';

type CitationTarget = {
  targetId: string;
  citationIds: string[];
};

type SyncCounts = {
  edgesCreated: number;
  citationsSkipped: number;
};

const collectCitationTargets = (
  citations: Array<{
    id: string;
    graphEntityId: string | null;
    graphConceptId: string | null;
    embeddingId: string | null;
  }>,
  field: 'graphEntityId' | 'graphConceptId' | 'embeddingId',
): CitationTarget[] => {
  const citationsByTarget = new Map<string, string[]>();

  for (const citation of citations) {
    const targetId = citation[field];
    if (!targetId) {
      continue;
    }
    const citationIds = citationsByTarget.get(targetId) ?? [];
    citationIds.push(citation.id);
    citationsByTarget.set(targetId, citationIds);
  }

  return Array.from(citationsByTarget, ([targetId, citationIds]) => ({
    targetId,
    citationIds,
  }));
};

const getCollectedIds = (result: Awaited<ReturnType<GraphTransaction['run']>>): string[] => {
  if (result.records.length === 0) {
    return [];
  }
  return (result.records[0].get('ids') as string[] | null) ?? [];
};

const linkCitationTargets = async (
  tx: GraphTransaction,
  messageId: string,
  userId: string,
  targets: CitationTarget[],
  targetLabel: 'Entity' | 'Concept' | 'Chunk',
): Promise<SyncCounts> => {
  if (targets.length === 0) {
    return { edgesCreated: 0, citationsSkipped: 0 };
  }

  const ids = targets.map(({ targetId }) => targetId);
  const targetMatch = targetLabel === 'Chunk'
    ? '(target:Chunk {embeddingId: targetId})'
    : `(target:${targetLabel} {id: targetId})`;
  const result = await tx.run(
    `UNWIND $ids AS targetId
     MATCH (m:Message {id: $messageId})
     MATCH ${targetMatch}
     MERGE (m)-[r:REFERENCED {source: 'citation'}]->(target)
     SET r = {source: 'citation', userId: $userId}
     RETURN collect(DISTINCT targetId) AS ids`,
    { ids, messageId, userId },
  );

  const linkedIds = new Set(getCollectedIds(result));
  const skippedTargets = targets.filter(({ targetId }) => !linkedIds.has(targetId));
  if (skippedTargets.length > 0) {
    logger.warn('Conversation graph: citation target not found, skipped', {
      messageId,
      targetIds: skippedTargets.map(({ targetId }) => targetId),
      citationTargets: skippedTargets.flatMap(({ targetId, citationIds }) => (
        citationIds.map((citationId) => ({ citationId, targetId }))
      )),
    });
  }

  return {
    edgesCreated: linkedIds.size,
    citationsSkipped: skippedTargets.reduce(
      (count, { citationIds }) => count + citationIds.length,
      0,
    ),
  };
};

export async function syncConversationGraph(data: ConversationGraphSyncJobData): Promise<void> {
  const { chatId } = data;
  const messageIds = Array.from(new Set(data.messageIds));
  const chat = await db.chat.findUnique({
    where: { id: chatId },
    select: {
      id: true,
      userId: true,
      createdAt: true,
    },
  });

  if (!chat) {
    logger.warn('Conversation graph: chat not found, skipped', { chatId });
    return;
  }
  const userId = chat.userId;

  // Graph records are only read by graph-access features, so check access live per job to
  // handle access loss or gain like the Memory toggle. This must gate only graph-database
  // writes; message-search indexing added to this job later must remain outside this gate.
  // Query directly because the shared access helper swallows lookup errors, while queued jobs
  // must let them throw so the queue retries instead of recording a false completion.
  const graphAccessCount = await db.userGroupMembership.count({
    where: { userId, userGroup: { graphDatabaseEnabled: true } },
  });
  const hasGraphAccess = graphAccessCount > 0;
  if (!hasGraphAccess) {
    logger.info('Conversation graph: graph projection skipped, chat owner has no graph database access', {
      chatId,
      userId,
    });
  }

  const messages = await db.chatMessage.findMany({
    where: { id: { in: messageIds }, chatId },
    include: {
      chatMessageCitations: true,
      chatArtifacts: {
        select: {
          id: true,
          label: true,
          fileExtension: true,
          createdAt: true,
        },
      },
    },
  });
  const orderedMessages = await db.chatMessage.findMany({
    where: { chatId },
    select: { id: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const positionByMessageId = new Map(
    orderedMessages.map((message, position) => [message.id, position]),
  );
  const returnedMessageIds = new Set(messages.map(({ id }) => id));
  const missingMessageIds = messageIds.filter((messageId) => !returnedMessageIds.has(messageId));
  if (missingMessageIds.length > 0) {
    logger.warn('Conversation graph: messages not found, skipped', {
      chatId,
      messageIds: missingMessageIds,
    });
  }

  let messagesSynced = 0;
  let edgesCreated = 0;
  let citationsSkipped = 0;
  // Only the graph projection is gated on graph access. The message-search sidecar below
  // always runs: conversation search, recents, and citations read Postgres and work without
  // the graph, so a user without graph access still gets working memory. With no access there
  // is no graph session and nothing to project, so the loop below has nothing to iterate.
  const graphDb = hasGraphAccess && messages.length > 0 ? await getGraphDatabaseSource() : null;
  const messagesByPosition = graphDb
    ? [...messages].sort(
      (left, right) => (positionByMessageId.get(left.id) ?? 0) - (positionByMessageId.get(right.id) ?? 0),
    )
    : [];

  for (const message of messagesByPosition) {
    const position = positionByMessageId.get(message.id);
    if (position === undefined) {
      logger.warn('Conversation graph: message position not found, skipped', {
        chatId,
        messageId: message.id,
      });
      continue;
    }

    const session = await graphDb!.getSession();
    const tx = session.beginTransaction();

    try {
      await tx.run(
        `MERGE (c:Chat {id: $chatId})
         SET c = {id: $chatId, userId: $userId, createdAt: datetime($createdAt)}`,
        {
          chatId,
          userId,
          createdAt: chat.createdAt.toISOString(),
        },
      );
      await tx.run(
        `MERGE (m:Message {id: $messageId})
         SET m = {
           id: $messageId,
           chatId: $chatId,
           userId: $userId,
           role: $role,
         position: $position,
         createdAt: datetime($createdAt)
         }
         WITH m
         MATCH (c:Chat {id: $chatId})
         MERGE (m)-[inChat:IN_CHAT]->(c)
         SET inChat = {userId: $userId}`,
        {
          messageId: message.id,
          chatId,
          userId,
          role: message.role,
          position,
          createdAt: message.createdAt.toISOString(),
        },
      );
      const existingArtifactsResult = await tx.run(
        `MATCH (m:Message {id: $messageId})-[:PRODUCED]->(a:Artifact)
         RETURN collect(a.id) AS ids`,
        { messageId: message.id },
      );
      const existingArtifactIds = getCollectedIds(existingArtifactsResult);

      await tx.run(
        `MATCH (m:Message {id: $messageId})-[r:REFERENCED|PRODUCED]->()
         DELETE r`,
        { messageId: message.id },
      );

      const citationTargetGroups: Array<{
        label: 'Entity' | 'Concept' | 'Chunk';
        targets: CitationTarget[];
      }> = [
        {
          label: 'Entity',
          targets: collectCitationTargets(message.chatMessageCitations, 'graphEntityId'),
        },
        {
          label: 'Concept',
          targets: collectCitationTargets(message.chatMessageCitations, 'graphConceptId'),
        },
        {
          label: 'Chunk',
          targets: collectCitationTargets(message.chatMessageCitations, 'embeddingId'),
        },
      ];
      for (const { label, targets } of citationTargetGroups) {
        const counts = await linkCitationTargets(tx, message.id, userId, targets, label);
        edgesCreated += counts.edgesCreated;
        citationsSkipped += counts.citationsSkipped;
      }

      const artifacts = message.chatArtifacts.map((artifact) => ({
        id: artifact.id,
        label: artifact.label,
        fileExtension: artifact.fileExtension,
        createdAt: artifact.createdAt.toISOString(),
      }));
      if (artifacts.length > 0) {
        await tx.run(
          `UNWIND $artifacts AS artifact
           MATCH (m:Message {id: $messageId})
           MERGE (a:Artifact {id: artifact.id})
           SET a = {
             id: artifact.id,
             userId: $userId,
             label: artifact.label,
             fileExtension: artifact.fileExtension,
             createdAt: datetime(artifact.createdAt)
           }
           MERGE (m)-[produced:PRODUCED]->(a)
           SET produced = {userId: $userId}`,
          { artifacts, messageId: message.id, userId },
        );
        edgesCreated += artifacts.length;
      }

      const currentArtifactIds = new Set(artifacts.map(({ id }) => id));
      const staleIds = existingArtifactIds.filter((id) => !currentArtifactIds.has(id));
      if (staleIds.length > 0) {
        await tx.run(
          `UNWIND $staleIds AS staleId
           MATCH (a:Artifact {id: staleId})
           WHERE NOT ()-[:PRODUCED]->(a)
           DETACH DELETE a`,
          { staleIds },
        );
      }

      await tx.commit();
      messagesSynced += 1;
      edgesCreated += 1;
    } catch (error) {
      await tx.rollback();
      logger.error('Conversation graph: message sync failed', {
        chatId,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    } finally {
      await session.close();
    }
  }

  if (graphDb) {
    await graphDb.run(
      `UNWIND $positions AS mp
       MATCH (m:Message {id: mp.id})
       SET m.position = mp.position`,
      {
        positions: orderedMessages.map(({ id }, position) => ({ id, position })),
      },
    );
  }

  let sidecarRowsWritten = 0;
  let sidecarRowsDeleted = 0;
  const searchableMessages = messages.filter(({ content }) => content.trim().length > 0);
  const blankMessages = messages.filter(({ content }) => content.trim().length === 0);

  if (searchableMessages.length > 0 || blankMessages.length > 0) {
    try {
      if (blankMessages.length > 0) {
        const blankMessageIds = blankMessages.map(({ id }) => id);
        const deleteQuery = Prisma.sql`
          DELETE FROM "chat_message_search"
          WHERE "messageId" = ANY(${blankMessageIds}::uuid[])
        `;

        const deletedCount = await db.$executeRaw(deleteQuery);
        sidecarRowsDeleted += deletedCount;
      }

      for (
        let batchStart = 0;
        batchStart < searchableMessages.length;
        batchStart += CONVERSATION_SIDECAR_EMBED_BATCH_SIZE
      ) {
        const batchMessages = searchableMessages.slice(
          batchStart,
          batchStart + CONVERSATION_SIDECAR_EMBED_BATCH_SIZE,
        );
        const texts = batchMessages.map((message) => {
          if (message.content.length > CONVERSATION_SIDECAR_EMBED_MAX_CHARS) {
            logger.warn('Conversation graph: message text bounded for sidecar embedding', {
              chatId,
              messageId: message.id,
              textLength: message.content.length,
              limit: CONVERSATION_SIDECAR_EMBED_MAX_CHARS,
            });
          }
          return message.content.slice(0, CONVERSATION_SIDECAR_EMBED_MAX_CHARS);
        });
        const embeddingResult = await retryWithBackoff(() => embedContent(texts, userId));
        const embeddings = embeddingResult.embeddings;
        if (!embeddings || embeddings.length !== batchMessages.length) {
          throw new Error('Conversation graph sidecar embedding count mismatch');
        }

        const values = batchMessages.map((message, index) => {
          const embedding = embeddings[index].embedding;
          if (embedding.length === 0 || !embedding.every((value) => (
            typeof value === 'number' && Number.isFinite(value)
          ))) {
            throw new Error(`Invalid conversation graph sidecar embedding at index ${index}`);
          }
          const vectorString = `[${embedding.join(',')}]`;

          // The word list and the embedding are derived from the same message content in the
          // same statement, so the two search arms cannot disagree. No text is stored here:
          // search joins back to ChatMessage.content, the single source of truth.
          return Prisma.sql`(
            ${Prisma.sql`${message.id}::uuid`},
            ${Prisma.sql`${userId}::uuid`},
            to_tsvector('english', ${message.content}),
            ${Prisma.sql`${vectorString}::vector`}
          )`;
        });
        const upsertQuery = Prisma.sql`
          INSERT INTO "chat_message_search" ("messageId", "userId", "textSearch", "embedding")
          VALUES ${Prisma.join(values, ', ')}
          ON CONFLICT ("messageId") DO UPDATE
            SET "textSearch" = EXCLUDED."textSearch",
                "userId" = EXCLUDED."userId",
                "embedding" = EXCLUDED."embedding"
        `;

        await db.$executeRaw(upsertQuery);
        sidecarRowsWritten += batchMessages.length;
      }
    } catch (error) {
      logger.error('Conversation graph: message search sidecar sync failed', {
        chatId,
        userId,
        messageIds: messages.map(({ id }) => id),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  logger.info('Conversation graph sync completed', {
    chatId,
    messagesSynced,
    edgesCreated,
    citationsSkipped,
    sidecarRowsWritten,
    sidecarRowsDeleted,
  });
}
