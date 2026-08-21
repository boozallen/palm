import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';

const nodeTypeSchema = z.object({
  labels: z.array(z.string()),
  count: z.number(),
});

const relationshipTypeSchema = z.object({
  type: z.string(),
  count: z.number(),
});

const outputSchema = z.object({
  success: z.boolean(),
  overview: z.object({
    totalNodes: z.number(),
    totalRelationships: z.number(),
    nodeTypes: z.array(nodeTypeSchema),
    relationshipTypes: z.array(relationshipTypeSchema),
  }),
});

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    ctx.logger.debug('[GRAPH-OVERVIEW] Getting graph overview statistics');

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
      
      const nodeTypes = nodeTypesResult.records.map(r => ({
        labels: r.get('nodeLabels'),
        count: typeof r.get('nodeCount') === 'object' && r.get('nodeCount').toNumber 
          ? r.get('nodeCount').toNumber() 
          : r.get('nodeCount'),
      }));

      const relationshipTypes = relationshipTypesResult.records.map(r => ({
        type: r.get('relationshipType'),
        count: typeof r.get('relationshipCount') === 'object' && r.get('relationshipCount').toNumber 
          ? r.get('relationshipCount').toNumber() 
          : r.get('relationshipCount'),
      }));

      const response = {
        success: true,
        overview: {
          totalNodes: typeof totalNodes === 'object' && totalNodes.toNumber ? totalNodes.toNumber() : totalNodes,
          totalRelationships: typeof totalRelationships === 'object' && totalRelationships.toNumber ? totalRelationships.toNumber() : totalRelationships,
          nodeTypes,
          relationshipTypes,
        },
      };

      ctx.logger.debug(`[GRAPH-OVERVIEW] Returning overview with ${response.overview.totalNodes} nodes and ${response.overview.totalRelationships} relationships`);
      return response;
    } finally {
      await session.close();
    }
  });