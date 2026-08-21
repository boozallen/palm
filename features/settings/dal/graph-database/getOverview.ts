import { getGraphDatabaseSource } from '@/features/graph-database';
import logger from '@/server/logger';

export interface NodeType {
  labels: string[];
  count: number;
}

export interface RelationshipType {
  type: string;
  count: number;
}

export interface OverviewResult {
  totalNodes: number;
  totalRelationships: number;
  nodeTypes: NodeType[];
  relationshipTypes: RelationshipType[];
}

/**
 * Gets overview statistics from the graph database
 */
export default async function getOverview(): Promise<OverviewResult> {
  logger.debug('[DAL-GRAPH-OVERVIEW] Getting graph overview statistics');

  try {
    const graphDb = await getGraphDatabaseSource();
    const session = await graphDb.getSession();

    try {
      // Get total node count
      const nodeCountResult = await session.run(`
        MATCH (n) 
        RETURN count(n) as totalNodes
      `);
      
      // Get total relationship count
      const relationshipCountResult = await session.run(`
        MATCH ()-[r]->() 
        RETURN count(r) as totalRelationships
      `);
      
      // Get node types with their labels and counts
      const nodeTypesResult = await session.run(`
        MATCH (n)
        WITH labels(n) as nodeLabels, count(n) as nodeCount
        WHERE size(nodeLabels) > 0
        RETURN nodeLabels, nodeCount
        ORDER BY nodeCount DESC
      `);

      // Get relationship types and counts
      const relationshipTypesResult = await session.run(`
        MATCH ()-[r]->() 
        WITH type(r) as relationshipType, count(r) as relationshipCount
        RETURN relationshipType, relationshipCount
        ORDER BY relationshipCount DESC
      `);

      const totalNodes = nodeCountResult.records[0]?.get('totalNodes') || 0;
      const totalRelationships = relationshipCountResult.records[0]?.get('totalRelationships') || 0;
      
      const nodeTypes: NodeType[] = nodeTypesResult.records.map(r => ({
        labels: r.get('nodeLabels'),
        count: typeof r.get('nodeCount') === 'object' && r.get('nodeCount').toNumber 
          ? r.get('nodeCount').toNumber() 
          : r.get('nodeCount'),
      }));

      const relationshipTypes: RelationshipType[] = relationshipTypesResult.records.map(r => ({
        type: r.get('relationshipType'),
        count: typeof r.get('relationshipCount') === 'object' && r.get('relationshipCount').toNumber 
          ? r.get('relationshipCount').toNumber() 
          : r.get('relationshipCount'),
      }));

      const overviewResult: OverviewResult = {
        totalNodes: typeof totalNodes === 'object' && totalNodes.toNumber ? totalNodes.toNumber() : totalNodes,
        totalRelationships: typeof totalRelationships === 'object' && totalRelationships.toNumber ? totalRelationships.toNumber() : totalRelationships,
        nodeTypes,
        relationshipTypes,
      };

      logger.debug(`[DAL-GRAPH-OVERVIEW] Returning overview with ${overviewResult.totalNodes} nodes and ${overviewResult.totalRelationships} relationships`);
      return overviewResult;
    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('Error fetching graph overview data', error);
    throw new Error('Error fetching graph overview data');
  }
}
