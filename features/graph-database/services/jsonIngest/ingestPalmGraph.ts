import { randomUUID } from 'crypto';
import type { Logger } from '@/server/logger';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { retryWithBackoff } from '@/features/graph-database/utils/retryWithBackoff';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import {
  createDocumentNode,
  createGraphEntityEmbedding,
  createGraphConceptEmbedding,
} from '@/features/graph-database/services/graphBuilder';
import {
  palmGraphSchema,
  type PalmGraph,
} from '@/features/graph-database/services/jsonIngest/types';
import { validateReferentialIntegrity } from '@/features/graph-database/services/jsonIngest/referentialIntegrity';
import {
  mergeCorporateStructure,
  mergePartneringMatchHits,
} from '@/features/graph-database/services/jsonIngest/supplementaryMerger';
import {
  writeNodes,
  writeEdges,
  writeDocumentMentions,
  EMBED_BATCH_SIZE,
} from '@/features/graph-database/services/jsonIngest/neo4jWriter';
import type {
  IngestResult,
  InternalEntity,
} from '@/features/graph-database/services/jsonIngest/types';

export interface IngestPalmGraphInput {
  palmGraph: PalmGraph;
  document: {
    id: string;
    filename: string;
    uploadStatus: string;
    createdAt: Date;
    userId: string;
    documentUploadProviderId: string;
    totalChunks: number;
    totalTokens: number;
  };
  userId: string;
  logger: Logger;
}

function textForEmbedding(entity: InternalEntity): string {
  const description = entity.description?.trim();
  return description ? `${entity.name} - ${description}` : entity.name;
}

async function embedAndStoreBatch(
  batch: InternalEntity[],
  label: 'Entity' | 'Concept',
  documentId: string,
  userId: string,
  logger: Logger
): Promise<{ stored: number; skipped: number }> {
  const batchTexts = batch.map(textForEmbedding);
  let embeddings: Array<{ embedding: number[] }> | undefined;
  try {
    const response = await retryWithBackoff(() => embedContent(batchTexts, userId));
    embeddings = response.embeddings;
  } catch (error) {
    logger.warn('[JSON-INGEST] Embedding batch failed after retries, skipping', {
      documentId,
      userId,
      label,
      batchSize: batch.length,
      error: (error as Error).message,
    });
    return { stored: 0, skipped: batch.length };
  }

  if (!embeddings || embeddings.length !== batch.length) {
    logger.warn('[JSON-INGEST] Embedding batch returned unexpected count, skipping', {
      documentId,
      userId,
      label,
      requested: batch.length,
      received: embeddings?.length ?? 0,
    });
    return { stored: 0, skipped: batch.length };
  }

  let stored = 0;
  let skipped = 0;
  for (let i = 0; i < batch.length; i++) {
    const entity = batch[i];
    const description = entity.description?.trim() ?? '';
    try {
      const normalizedName = entity.name.trim().toLowerCase();
      if (label === 'Entity') {
        await createGraphEntityEmbedding({
          id: entity.id,
          entityName: entity.name,
          embedding: embeddings[i].embedding,
          description,
          aliases: [],
          documentId,
          userId,
          type: entity.type,
          normalizedName,
        });
      } else {
        await createGraphConceptEmbedding({
          id: entity.id,
          conceptName: entity.name,
          embedding: embeddings[i].embedding,
          description,
          category: entity.type,
          documentId,
          userId,
          normalizedName,
        });
      }
      stored++;
    } catch (error) {
      skipped++;
      logger.error('[JSON-INGEST] Failed to write embedding row', {
        documentId,
        userId,
        entityId: entity.id,
        externalId: entity.externalId,
        label,
        error: (error as Error).message,
      });
    }
  }
  return { stored, skipped };
}

export async function ingestPalmGraph(
  input: IngestPalmGraphInput
): Promise<IngestResult> {
  const { document, userId, logger } = input;
  const documentId = document.id;

  const parsed: PalmGraph = palmGraphSchema.parse(input.palmGraph);

  logger.info('[JSON-INGEST] Palm graph parsed', {
    documentId,
    userId,
    entityCount: parsed.entities.length,
    relationCount: parsed.relations.length,
  });

  validateReferentialIntegrity(parsed);

  const { entities: entitiesAfterCorp, parentEdges } = mergeCorporateStructure(
    parsed.entities,
    parsed.supplementary?.corporate_structure
  );
  const relationsAfterHits = mergePartneringMatchHits(
    parsed.relations,
    parsed.supplementary?.partnering_match_hits,
    logger
  );
  const allRelations = [...relationsAfterHits, ...parentEdges];

  const idMap = new Map<string, string>();
  for (const entity of entitiesAfterCorp) {
    if (!idMap.has(entity.id)) {
      idMap.set(entity.id, randomUUID());
    }
  }

  const internalEntities: InternalEntity[] = entitiesAfterCorp.map((entity) => ({
    ...entity,
    id: idMap.get(entity.id)!,
    externalId: entity.id,
  }));

  const translatedRelations = [] as typeof allRelations;
  let droppedRelations = 0;
  for (const relation of allRelations) {
    const source = idMap.get(relation.source);
    const target = idMap.get(relation.target);
    if (!source || !target) {
      droppedRelations++;
      continue;
    }
    translatedRelations.push({ ...relation, source, target });
  }
  if (droppedRelations > 0) {
    logger.warn('[JSON-INGEST] Dropped relations with unresolved external ids', {
      documentId,
      userId,
      droppedRelations,
    });
  }

  const graphDb = await getGraphDatabaseSource();

  await createDocumentNode({
    id: document.id,
    filename: document.filename,
    uploadStatus: document.uploadStatus,
    createdAt: document.createdAt,
    userId: document.userId,
    documentUploadProviderId: document.documentUploadProviderId,
    totalChunks: document.totalChunks,
    totalTokens: document.totalTokens,
  });

  const { entityCount, conceptCount } = await writeNodes(
    graphDb,
    internalEntities,
    documentId,
    userId,
    logger
  );
  const { edgeCount } = await writeEdges(
    graphDb,
    translatedRelations,
    documentId,
    userId,
    logger
  );

  const entityLabelNodes = internalEntities.filter((e) => e.label === 'Entity');
  const conceptLabelNodes = internalEntities.filter((e) => e.label === 'Concept');

  await writeDocumentMentions(
    graphDb,
    documentId,
    userId,
    entityLabelNodes.map((e) => e.id),
    conceptLabelNodes.map((c) => c.id),
    logger
  );

  let embeddingCount = 0;
  let embeddingSkippedCount = 0;

  for (let i = 0; i < entityLabelNodes.length; i += EMBED_BATCH_SIZE) {
    const batch = entityLabelNodes.slice(i, i + EMBED_BATCH_SIZE);
    const { stored, skipped } = await embedAndStoreBatch(
      batch,
      'Entity',
      documentId,
      userId,
      logger
    );
    embeddingCount += stored;
    embeddingSkippedCount += skipped;
  }

  for (let i = 0; i < conceptLabelNodes.length; i += EMBED_BATCH_SIZE) {
    const batch = conceptLabelNodes.slice(i, i + EMBED_BATCH_SIZE);
    const { stored, skipped } = await embedAndStoreBatch(
      batch,
      'Concept',
      documentId,
      userId,
      logger
    );
    embeddingCount += stored;
    embeddingSkippedCount += skipped;
  }

  logger.info('[JSON-INGEST] Ingest complete', {
    documentId,
    userId,
    entityCount,
    conceptCount,
    edgeCount,
    embeddingCount,
    embeddingSkippedCount,
  });

  return {
    entityCount,
    conceptCount,
    edgeCount,
    embeddingCount,
    embeddingSkippedCount,
    documentCount: 1,
  };
}
