import { randomUUID } from 'crypto';
import db from '@/server/db';
import { SharedDocumentAction, SharedDocumentActionStatus } from '@/features/shared/types/document';
import logger from '@/server/logger';
import { getGraphCopyQueue } from '@/features/shared/utils/document-library/worker';
import { storage } from '@/server/storage/redis';
import { getSharedDocumentExpirationDate } from '@/features/shared/utils/dateUtils';

type AcceptSharedDocumentInput = {
  sharedDocumentId: string;
  userId: string;
  userGroupIds: string[];
};

export type AcceptSharedDocumentResult = {
  action: SharedDocumentAction;
  filename: string;
  graphCopyJobId: string | null;
};

export default async function acceptSharedDocument(
  input: AcceptSharedDocumentInput
): Promise<AcceptSharedDocumentResult> {
  const { sharedDocumentId, userId, userGroupIds } = input;

  // First, run the PostgreSQL transaction (extended timeout for large documents)
  const result = await db.$transaction(async (prisma) => {
    // Get the shared document with source document data
    const sharedDocument = await prisma.sharedDocument.findUnique({
      where: { id: sharedDocumentId },
      include: {
        sourceDocument: {
          include: {
            embeddings: true,
            graphEntityEmbeddings: true,
            graphConceptEmbeddings: true,
          },
        },
      },
    });

    if (!sharedDocument) {
      throw new Error('Shared document not found');
    }

    // Check if document has been soft deleted or is older than the expiration period
    const expirationDate = getSharedDocumentExpirationDate();
    
    if (sharedDocument.deletedAt || sharedDocument.createdAt <= expirationDate) {
      throw new Error('This share has expired');
    }

    // Verify user has access (is in one of the shared groups)
    const hasAccess = sharedDocument.sharedWithUserGroupIds.some(
      (groupId) => userGroupIds.includes(groupId)
    );

    if (!hasAccess) {
      throw new Error('You do not have access to this shared document');
    }

    const sourceDoc = sharedDocument.sourceDocument;

    // Create copy of the document for the accepting user
    const copiedDocument = await prisma.document.create({
      data: {
        userId,
        filename: sourceDoc.filename,
        uploadStatus: sourceDoc.uploadStatus,
        documentUploadProviderId: sourceDoc.documentUploadProviderId,
        text: sourceDoc.text,
      },
    });

    // Copy embeddings if they exist
    if (sourceDoc.embeddings.length > 0) {
      await prisma.$executeRaw`
        INSERT INTO "Embedding" (id, embedding, content, "startPosition", "endPosition", "contentNum", "createdAt", "documentId")
        SELECT gen_random_uuid(), embedding, content, "startPosition", "endPosition", "contentNum", NOW(), ${copiedDocument.id}::uuid
        FROM "Embedding"
        WHERE "documentId" = ${sourceDoc.id}::uuid
      `;
    }

    // Copy graph entity embeddings if they exist
    if (sourceDoc.graphEntityEmbeddings.length > 0) {
      await prisma.$executeRaw`
        INSERT INTO graph_entity_embeddings (id, "entityName", embedding, description, aliases, "documentId", "userId", "createdAt", "type", "normalizedName")
        SELECT gen_random_uuid(), "entityName", embedding, description, aliases, ${copiedDocument.id}::uuid, ${userId}::uuid, NOW(), "type", "normalizedName"
        FROM graph_entity_embeddings
        WHERE "documentId" = ${sourceDoc.id}::uuid
      `;
    }

    // Copy graph concept embeddings if they exist
    if (sourceDoc.graphConceptEmbeddings.length > 0) {
      await prisma.$executeRaw`
        INSERT INTO graph_concept_embeddings (id, "conceptName", embedding, description, category, "documentId", "userId", "createdAt", "normalizedName")
        SELECT gen_random_uuid(), "conceptName", embedding, description, category, ${copiedDocument.id}::uuid, ${userId}::uuid, NOW(), "normalizedName"
        FROM graph_concept_embeddings
        WHERE "documentId" = ${sourceDoc.id}::uuid
      `;
    }

    // Create the action record
    const action = await prisma.sharedDocumentAction.create({
      data: {
        sharedDocumentId,
        userId,
        status: SharedDocumentActionStatus.Accepted,
        copiedDocumentId: copiedDocument.id,
      },
    });

    // Check if source document has graph data (to determine if we need to queue a copy job)
    const hasGraphData = sourceDoc.graphEntityEmbeddings.length > 0 || sourceDoc.graphConceptEmbeddings.length > 0;

    logger.info(`User ${userId} accepted shared document ${sharedDocumentId}, created copy ${copiedDocument.id}`);

    return {
      action: {
        id: action.id,
        sharedDocumentId: action.sharedDocumentId,
        copiedDocumentId: action.copiedDocumentId ?? undefined,
        userId: action.userId,
        status: action.status as SharedDocumentActionStatus,
        createdAt: action.createdAt,
      },
      sourceDocumentId: sourceDoc.id,
      copiedDocumentId: copiedDocument.id,
      filename: sourceDoc.filename,
      hasGraphData,
    };
  }, {
    timeout: 25000, // 25 seconds for large documents with many embeddings
  });

  let graphCopyJobId: string | null = null;

  // Queue Neo4j graph copy job if source document has graph data
  if (result.hasGraphData) {
    const queue = getGraphCopyQueue();

    if (queue) {
      graphCopyJobId = randomUUID();

      // Initialize job status in Redis
      if (storage) {
        await storage.hset(`graph-copy-job:${graphCopyJobId}`, {
          status: 'queued',
          progress: 'Waiting to start graph copy...',
          created: Date.now(),
          last_updated: Date.now(),
        });
      }

      await queue.add('graph-copy', {
        jobId: graphCopyJobId,
        userId,
        sourceDocumentId: result.sourceDocumentId,
        targetDocumentId: result.copiedDocumentId,
        filename: result.filename,
      });

      logger.info(`Queued graph copy job ${graphCopyJobId} for document ${result.copiedDocumentId}`);
    } else {
      logger.warn('Graph copy queue not available, skipping Neo4j copy');
    }
  }

  return {
    action: result.action,
    filename: result.filename,
    graphCopyJobId,
  };
}
