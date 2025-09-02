import logger from '@/server/logger';
import db from '@/server/db';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import { Citation, ContextType } from '@/features/chat/types/message';

export type EmbeddingResult = {
  id: string;
  score: number;
  citation: Citation,
};

type RawEmbeddingResult = {
  id: string;
  content: string;
  score: number;
  documentLabel: string;
  documentId: string;
};

export type GetEmbeddingsParams = {
  userId: string;
  embeddedQuery: number[];
  minThreshold?: number;
  matchCount?: number;
};

export default async function getEmbeddings({
  userId,
  embeddedQuery,
  minThreshold = 0.5,
  matchCount = 10,
}: GetEmbeddingsParams): Promise<EmbeddingResult[]> {
  // Convert the embedding array to PostgreSQL vector format
  const vectorString = `[${embeddedQuery.join(',')}]`;
  let documentLibraryProviderId: string;
  try {
    // Get system configuration to determine which document upload provider to use
    const systemConfig = await getSystemConfig();
    documentLibraryProviderId = systemConfig.documentLibraryDocumentUploadProviderId ?? '';
  } catch (error) {
    logger.error('There was a problem retrieving the document library', error);
    throw new Error('There was a problem retrieving the document library');
  }

  if (!documentLibraryProviderId) {
    logger.warn('No document library provider configured in system config');
    throw new Error('A document library must be configured before using the document library');
  }

  // Query embeddings with security constraints:
  // 1. User must own the document
  // 2. Document must belong to the configured document upload provider
  try {
    const rawResults = await db.$queryRaw<RawEmbeddingResult[]>`
      SELECT
        e.id as id,
        e.content as content,
        (1 - (e.embedding <=> ${vectorString}::vector)) as score,
        d.filename as "documentLabel",
        d.id as "documentId"
      FROM "Embedding" e
      INNER JOIN "Document" d ON e."documentId" = d.id
      INNER JOIN "DocumentUploadProvider" dup ON d."documentUploadProviderId" = dup.id
      WHERE d."userId" = ${userId}::uuid
        AND dup.id = ${documentLibraryProviderId}::uuid
        AND dup."deletedAt" IS NULL
        AND (1 - (e.embedding <=> ${vectorString}::vector)) > ${minThreshold}
      ORDER BY score DESC
      LIMIT ${matchCount}
    `;

    // Transform raw results to match the EmbeddingResult type
    const results: EmbeddingResult[] = rawResults.map(row => ({
      id: row.id,
      score: row.score,
      citation: {
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: row.documentId,
        citation: row.content,
        sourceLabel: row.documentLabel,
      },
    }));

    return results;
  } catch (error) {
    logger.error('Error retrieving embeddings from the database', {
      userId,
      minThreshold,
      matchCount,
      error,
    });
    throw new Error('Error retrieving embeddings');
  }
}
