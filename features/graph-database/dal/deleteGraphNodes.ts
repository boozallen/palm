import { logger } from '@/server/logger';
import { getGraphDatabaseSource } from '@/features/graph-database';

/**
 * Delete graph nodes for a specific document
 * Removes Document nodes, Chunk nodes, Entity nodes, and Concept nodes associated with the document
 *
 * @param documentId - Document ID to delete nodes for
 */
export default async function deleteGraphNodes(documentId: string): Promise<void> {
  try {
    logger.info(`Deleting graph nodes for document: ${documentId}`);

    const graphDb = await getGraphDatabaseSource();

    await graphDb.run(
      `MATCH (e:Entity {documentId: $documentId})
       CALL { WITH e DETACH DELETE e } IN TRANSACTIONS OF 1000 ROWS`,
      { documentId }
    );

    await graphDb.run(
      `MATCH (con:Concept {documentId: $documentId})
       CALL { WITH con DETACH DELETE con } IN TRANSACTIONS OF 1000 ROWS`,
      { documentId }
    );

    await graphDb.run(
      `MATCH (d:Document {id: $documentId})-[:CONTAINS]->(c:Chunk)
       CALL { WITH c DETACH DELETE c } IN TRANSACTIONS OF 1000 ROWS`,
      { documentId }
    );

    await graphDb.run(
      'MATCH (d:Document {id: $documentId}) DETACH DELETE d',
      { documentId }
    );

    logger.info(`Successfully deleted graph nodes for document: ${documentId}`);
  } catch (error) {
    logger.error(`Error deleting graph nodes for document ${documentId}:`, error);
    throw new Error('Error deleting graph nodes');
  }
}
