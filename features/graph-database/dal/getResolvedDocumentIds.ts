import { getGraphDatabaseSource } from '@/features/graph-database';
import { logger } from '@/server/logger';

/**
 * Return the ids of a user's `:Document` nodes that are both extraction- and
 * resolution-complete (per-document Neo4j markers set by the build worker).
 *
 * This is the "already done" set the build gate consumes to decide
 * incremental-vs-full routing. Deriving "done" from per-document state — rather
 * than the graph-level `status: Completed` flag — means a build that crashed in
 * Resolving/Pending no longer demotes the next build to a whole-corpus
 * re-resolution: the documents that were finished stay finished.
 *
 * Strictly scoped by `userId`. Unset markers coalesce to false, so a document
 * that has only finished extraction is not reported as resolved.
 */
export async function getResolvedDocumentIds(userId: string): Promise<string[]> {
  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(
      `MATCH (d:Document {userId: $userId})
       WHERE coalesce(d.extractionComplete, false) = true
         AND coalesce(d.resolutionComplete, false) = true
       RETURN d.id AS id`,
      { userId }
    );

    return result.records.map((record) => record.get('id') as string);
  } catch (error) {
    logger.error('Error fetching resolved document ids', { userId, error });
    throw new Error('Failed to fetch resolved documents');
  }
}
