/**
 * Clean up graph-related data for specified document IDs or all documents
 *
 * This script deletes:
 * 1. GraphMetadata records
 * 2. Entity embeddings (graph_entity_embeddings table)
 * 3. Concept embeddings (graph_concept_embeddings table)
 * 4. Graph database data (Document, Chunk, Entity, Concept nodes)
 *
 * Usage:
 * # Clean specific documents:
 * docker exec frontend yarn ts-node -r tsconfig-paths/register scripts/cleanup-graph-embeddings.ts <documentId1> <documentId2> ...
 *
 * # Clean ALL graph data:
 * docker exec frontend yarn ts-node -r tsconfig-paths/register scripts/cleanup-graph-embeddings.ts --all
 */

import { Prisma } from '@prisma/client';

import db from '@/server/db';
import { getGraphDatabaseSource } from '@/features/graph-database';

async function cleanupGraphData(documentIds: string[]): Promise<void> {
  console.log(`\n=== Cleaning up graph data for ${documentIds.length} documents ===\n`);

  for (const documentId of documentIds) {
    console.log(`Processing document: ${documentId}`);

    // 1. Delete entity embeddings (raw SQL required)
    try {
      const entityDeleteResult = await db.$executeRaw(
        Prisma.sql`DELETE FROM graph_entity_embeddings WHERE "documentId" = ${documentId}::uuid`
      );
      console.log(`  ✓ Deleted ${entityDeleteResult} entity embeddings`);
    } catch (error) {
      console.error('  ✗ Error deleting entity embeddings:', error);
    }

    // 2. Delete concept embeddings (raw SQL required)
    try {
      const conceptDeleteResult = await db.$executeRaw(
        Prisma.sql`DELETE FROM graph_concept_embeddings WHERE "documentId" = ${documentId}::uuid`
      );
      console.log(`  ✓ Deleted ${conceptDeleteResult} concept embeddings`);
    } catch (error) {
      console.error('  ✗ Error deleting concept embeddings:', error);
    }

    // 3. Delete graph database data
    try {
      const graphDb = await getGraphDatabaseSource();
      await graphDb.connect();

      // Delete all nodes and relationships for this document
      await graphDb.run(`
        MATCH (d:Document {id: $documentId})
        OPTIONAL MATCH (d)-[:CONTAINS]->(c:Chunk)
        OPTIONAL MATCH (c)-[:MENTIONS]->(e:Entity)
        OPTIONAL MATCH (c)-[:DISCUSSES]->(concept:Concept)
        DETACH DELETE d, c, e, concept
      `, { documentId });

      console.log('  ✓ Deleted Neo4j graph data');
    } catch (error) {
      console.error('  ✗ Error deleting Neo4j data:', error);
    }
  }

  // 4. Delete GraphMetadata records for these documents
  try {
    const graphMetadataDeleteResult = await db.graphMetadata.deleteMany({
      where: {
        documentIds: {
          hasSome: documentIds,
        },
      },
    });
    console.log(`\n✓ Deleted ${graphMetadataDeleteResult.count} GraphMetadata records`);
  } catch (error) {
    console.error('\n✗ Error deleting GraphMetadata:', error);
  }

  // 5. Disconnect graph database
  const graphDb = await getGraphDatabaseSource();
      await graphDb.disconnect();

  console.log('\n=== Cleanup complete ===\n');
}

// Parse command line arguments
const args = process.argv.slice(2);

/**
 * Delete ALL embeddings and graph data (when --all flag used)
 */
async function cleanupAllGraphData(): Promise<void> {
  console.log('\n=== Cleaning up ALL graph data ===\n');

  // 1. Delete all entity embeddings
  try {
    const entityDeleteResult = await db.$executeRaw(
      Prisma.sql`DELETE FROM graph_entity_embeddings`
    );
    console.log(`✓ Deleted ${entityDeleteResult} entity embeddings`);
  } catch (error) {
    console.error('✗ Error deleting entity embeddings:', error);
  }

  // 2. Delete all concept embeddings
  try {
    const conceptDeleteResult = await db.$executeRaw(
      Prisma.sql`DELETE FROM graph_concept_embeddings`
    );
    console.log(`✓ Deleted ${conceptDeleteResult} concept embeddings`);
  } catch (error) {
    console.error('✗ Error deleting concept embeddings:', error);
  }

  // 3. Delete ALL Neo4j graph data
  try {
    const graphDb = await getGraphDatabaseSource();
    await graphDb.connect();
    await graphDb.run('MATCH (n) DETACH DELETE n');
    console.log('✓ Deleted all Neo4j graph data');
  } catch (error) {
    console.error('✗ Error deleting Neo4j data:', error);
  }

  // 4. Delete all GraphBuildRun records (audit trail)
  try {
    const buildRunsDeleteResult = await db.graphBuildRun.deleteMany({});
    console.log(`✓ Deleted ${buildRunsDeleteResult.count} GraphBuildRun records`);
  } catch (error) {
    console.error('✗ Error deleting GraphBuildRun records:', error);
  }

  // 5. Delete all DocumentResolutionPair records (resolution tracking)
  try {
    const resolutionPairsDeleteResult = await db.documentResolutionPair.deleteMany({});
    console.log(`✓ Deleted ${resolutionPairsDeleteResult.count} DocumentResolutionPair records`);
  } catch (error) {
    console.error('✗ Error deleting DocumentResolutionPair records:', error);
  }

  // 6. Delete all GraphMetadata records
  try {
    const graphMetadataDeleteResult = await db.graphMetadata.deleteMany({});
    console.log(`✓ Deleted ${graphMetadataDeleteResult.count} GraphMetadata records`);
  } catch (error) {
    console.error('✗ Error deleting GraphMetadata:', error);
  }

  // 7. Disconnect graph database
  const graphDb = await getGraphDatabaseSource();
  await graphDb.disconnect();

  console.log('\n=== Cleanup complete ===\n');
}

// Main execution
(async () => {
  if (args.length === 0 || args[0] === '--all') {
    // Clean ALL graph data (don't rely on GraphMetadata)
    await cleanupAllGraphData();
  } else {
    // Clean specific documents
    const documentIds = args;
    await cleanupGraphData(documentIds);
  }
})().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
