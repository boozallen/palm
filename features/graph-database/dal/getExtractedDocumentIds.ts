import { getGraphDatabaseSource } from '@/features/graph-database';
import { logger } from '@/server/logger';

/**
 * Return the ids of a user's `:Document` nodes that have finished extraction
 * (the per-document Neo4j marker set by the build worker).
 *
 * This is the "already graphed" set the build gate consumes when entity
 * resolution is disabled: with no resolution pass running, a document is done
 * once it is extracted. Deriving "done" from the per-document `extractionComplete`
 * marker — rather than a graph's `documentIds` membership — means a base graph
 * that died mid-extraction does not cause its un-extracted documents to be
 * treated as done and skipped.
 *
 * Strictly scoped by `userId`. Unset markers coalesce to false.
 */
export async function getExtractedDocumentIds(userId: string): Promise<string[]> {
  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(
      `MATCH (d:Document {userId: $userId})
       WHERE coalesce(d.extractionComplete, false) = true
       RETURN d.id AS id`,
      { userId }
    );

    return result.records.map((record) => record.get('id') as string);
  } catch (error) {
    logger.error('Error fetching extracted document ids', { userId, error });
    throw new Error('Failed to fetch extracted documents');
  }
}
