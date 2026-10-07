import logger from '@/server/logger';
import db from '@/server/db';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import { Citation, ContextType } from '@/features/chat/types/message';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

export type EmbeddingResult = {
  id: string;
  score: number;
  citation: Citation,
};

type RawEmbeddingResult = {
  id: string;
  content: string;
  startPosition: number | null;
  endPosition: number | null;
  sectionPath: string[];
  pageStart: number | null;
  pageEnd: number | null;
  documentText: string | null;
  score: number;
  documentLabel: string;
  documentId: string;
};

export type GetEmbeddingsForDocumentsParams = {
  userId: string;
  embeddedQuery: number[];
  documentIds: string[];
  accessibleDocIds: AccessibleDocIds;
  minThreshold?: number;
  matchCount?: number;
};

export default async function getEmbeddingsForDocuments({
  userId,
  embeddedQuery,
  documentIds,
  accessibleDocIds,
  minThreshold = 0.35, // (35% similarity)
  matchCount = 10,
}: GetEmbeddingsForDocumentsParams): Promise<EmbeddingResult[]> {
  // Convert the embedding array to PostgreSQL vector format
  const vectorString = `[${embeddedQuery.join(',')}]`;
  let documentLibraryProviderId: string;
  
  try {
    // Get system configuration to determine which document upload provider to use
    const systemConfig = await getSystemConfig();
    documentLibraryProviderId = systemConfig.documentLibraryDocumentUploadProviderId ?? '';
  } catch (error) {
    logger.error('[RAG] There was a problem retrieving the document library', error);
    throw new Error('There was a problem retrieving the document library');
  }

  if (!documentLibraryProviderId) {
    logger.warn('[RAG] No document library provider configured in system config');
    throw new Error('A document library must be configured before using the document library');
  }

  // Return empty array if no document IDs provided
  if (!documentIds.length) {
    logger.info('[RAG] No document IDs provided, returning empty results');
    return [];
  }

  // Query embeddings with security constraints and specific document IDs:
  // 1. User must own the document
  // 2. Document must belong to the configured document upload provider
  // 3. Document must be in the list of selected documentIds
  try {
    logger.info(`[RAG] Querying embeddings for user ${userId} with provider ${documentLibraryProviderId}, threshold ${minThreshold}, document IDs: ${documentIds.join(', ')}`);

    // Debug: Check top scores without threshold to understand what we're getting
    const debugResults = await db.$queryRaw<{ score: number; content_preview: string }[]>`
      SELECT
        (1 - (e.embedding <=> ${vectorString}::vector)) as score,
        LEFT(e.content, 100) as content_preview
      FROM "Embedding" e
      INNER JOIN "Document" d ON e."documentId" = d.id
      WHERE d.id = ANY(${documentIds}::uuid[])
      ORDER BY score DESC
      LIMIT 5
    `;
    logger.info(`[RAG] Debug: Top 5 similarity scores (no threshold): ${JSON.stringify(debugResults.map(r => ({ score: r.score, preview: r.content_preview?.substring(0, 50) })))}`);

    const accessibleArray = Array.from(accessibleDocIds);

    const rawResults = await db.$queryRaw<RawEmbeddingResult[]>`
      SELECT
        e.id as id,
        e.content as content,
        e."startPosition" as "startPosition",
        e."endPosition" as "endPosition",
        e."sectionPath" as "sectionPath",
        e."pageStart" as "pageStart",
        e."pageEnd" as "pageEnd",
        d.text as "documentText",
        (1 - (e.embedding <=> ${vectorString}::vector)) as score,
        d.filename as "documentLabel",
        d.id as "documentId"
      FROM "Embedding" e
      INNER JOIN "Document" d ON e."documentId" = d.id
      INNER JOIN "DocumentUploadProvider" dup ON d."documentUploadProviderId" = dup.id
      WHERE dup.id = ${documentLibraryProviderId}::uuid
        AND dup."deletedAt" IS NULL
        AND d.id = ANY(${documentIds}::uuid[])
        AND d.id = ANY(${accessibleArray}::uuid[])
        AND (1 - (e.embedding <=> ${vectorString}::vector)) > ${minThreshold}
      ORDER BY score DESC
      LIMIT ${matchCount}
    `;

    logger.info(`[RAG] Found ${rawResults.length} matching embeddings from specific documents`);

    // Transform raw results and extract citations from Document.text using positions
    const results: EmbeddingResult[] = rawResults.map(row => {
      let citationText: string;

      // Extract from Document.text if positions are available
      if (row.startPosition !== null && row.endPosition !== null && row.documentText) {
        // Bounds checking
        if (row.startPosition >= 0 && row.endPosition <= row.documentText.length && row.startPosition < row.endPosition) {
          citationText = row.documentText.substring(row.startPosition, row.endPosition);

          // Validation - ensure extraction worked
          if (!citationText || citationText.trim().length === 0) {
            logger.warn(`[RAG] Empty citation extracted from positions ${row.startPosition}-${row.endPosition}, falling back to chunk content`);
            citationText = row.content;
          }
        } else {
          logger.error(`[RAG] Invalid position bounds for embedding ${row.id}: startPosition=${row.startPosition}, endPosition=${row.endPosition}, textLength=${row.documentText.length}`);
          citationText = row.content;
        }
      } else {
        // Fallback: Use chunk content for old embeddings or NULL Document.text
        citationText = row.content;

        if (row.startPosition === null || row.endPosition === null) {
          logger.debug(`[RAG] Embedding ${row.id} has no position data, using chunk content`);
        }
        if (!row.documentText) {
          logger.debug(`[RAG] Document ${row.documentId} has no text stored, using chunk content`);
        }
      }

      return {
        id: row.id,
        score: row.score,
        citation: {
          contextType: ContextType.DOCUMENT_LIBRARY,
          documentId: row.documentId,
          embeddingId: row.id,
          citation: citationText,
          sourceLabel: row.documentLabel,
          startPosition: row.startPosition ?? undefined,
          endPosition: row.endPosition ?? undefined,
          sectionPath: row.sectionPath,
          pageStart: row.pageStart ?? undefined,
          pageEnd: row.pageEnd ?? undefined,
        },
      };
    });

    return results;
  } catch (error) {
    logger.error('[RAG] Error retrieving embeddings from specific documents', {
      userId,
      documentIds,
      minThreshold,
      matchCount,
      error,
    });
    throw new Error('Error retrieving embeddings from specific documents');
  }
}
