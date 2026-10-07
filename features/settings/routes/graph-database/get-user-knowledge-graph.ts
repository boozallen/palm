import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';

const inputSchema = z.object({
  limit: z.number().optional().default(200),
  labels: z.array(z.string()).optional().default([]),
  relationships: z.array(z.string()).optional().default([]),
});

const nodeSchema = z.object({
  id: z.number(),
  label: z.string(),
  labels: z.array(z.string()),
  properties: z.record(z.any()),
  group: z.string(),
});

const edgeSchema = z.object({
  from: z.number(),
  to: z.number(),
  label: z.string(),
  type: z.string(),
  properties: z.record(z.any()),
});

const outputSchema = z.object({
  success: z.boolean(),
  network: z.object({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
  }),
  metadata: z.object({
    nodeCount: z.number(),
    edgeCount: z.number(),
    limit: z.number(),
    filters: z.object({
      labels: z.array(z.string()),
      relationships: z.array(z.string()),
    }),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
    }

    const { limit: rawLimit, labels, relationships } = input;
    const limit = Math.min(rawLimit, 1000);

    ctx.logger.debug(`[GRAPH-ADMIN-NETWORK] Getting all network data, limit: ${limit}`);

    const graphDb = await getGraphDatabaseSource();
    const session = await graphDb.getSession();

    try {
      // Build filters. :IdentityCluster/:IN_CLUSTER are internal structural
      // plumbing (no documentId, no user-facing content) — this admin view
      // uses untyped MATCH (n) with no documentId scoping, so it must exclude
      // them explicitly rather than relying on that scoping as protection.
      // The relationship exclusion is written null-safe (m/r IS NULL OR ...)
      // so it doesn't also drop isolated nodes from the OPTIONAL MATCH miss.
      let nodeFilter = 'WHERE NOT n:IdentityCluster';
      let relationshipFilter = 'WHERE (m IS NULL OR NOT m:IdentityCluster) AND (r IS NULL OR type(r) <> \'IN_CLUSTER\')';

      if (labels.length > 0) {
        const labelConditions = labels.map(label => `'${label}' IN labels(n)`).join(' OR ');
        nodeFilter += ` AND (${labelConditions})`;
      }

      if (relationships.length > 0) {
        const relConditions = relationships.map(rel => `type(r) = '${rel}'`).join(' OR ');
        relationshipFilter += ` AND (${relConditions})`;
      }

      // Query for all nodes and relationships (admin view)
      const networkQuery = `
        MATCH (n)
        ${nodeFilter}
        WITH n
        LIMIT ${limit}
        OPTIONAL MATCH (n)-[r]-(m)
        ${relationshipFilter}
        
        RETURN 
          n,
          labels(n) as nLabels,
          properties(n) as nProperties,
          id(n) as nId,
          r,
          type(r) as rType,
          properties(r) as rProperties,
          m,
          labels(m) as mLabels,
          properties(m) as mProperties,
          id(m) as mId
      `;

      const result = await session.run(networkQuery);

      // Process nodes and relationships
      const nodesMap = new Map();
      const edgesSet = new Set();
      const edges: any[] = [];

      for (const record of result.records) {
        const _n = record.get('n');
        const nId = record.get('nId');
        const nLabels = record.get('nLabels');
        const nProperties = record.get('nProperties');

        // Add main node
        if (nId && !nodesMap.has(nId.toString())) {
          const primaryLabel = nLabels && nLabels.length > 0 ? nLabels[0] : 'Node';
          const nodeLabel = nProperties?.name || nProperties?.title || nProperties?.filename || nProperties?.id || `${primaryLabel}-${nId}`;
          
          nodesMap.set(nId.toString(), {
            id: typeof nId === 'object' && nId.toNumber ? nId.toNumber() : parseInt(nId.toString()),
            label: nodeLabel,
            labels: nLabels || [],
            properties: nProperties || {},
            group: primaryLabel,
          });
        }

        // Add connected node and relationship if they exist
        const r = record.get('r');
        const m = record.get('m');
        
        if (r && m) {
          const mId = record.get('mId');
          const mLabels = record.get('mLabels');
          const mProperties = record.get('mProperties');
          const rType = record.get('rType');
          const rProperties = record.get('rProperties');

          // Add connected node
          if (!nodesMap.has(mId.toString())) {
            const primaryLabel = mLabels && mLabels.length > 0 ? mLabels[0] : 'Node';
            const nodeLabel = mProperties?.name || mProperties?.title || mProperties?.filename || mProperties?.id || `${primaryLabel}-${mId}`;
            
            nodesMap.set(mId.toString(), {
              id: typeof mId === 'object' && mId.toNumber ? mId.toNumber() : parseInt(mId.toString()),
              label: nodeLabel,
              labels: mLabels || [],
              properties: mProperties || {},
              group: primaryLabel,
            });
          }

          // Add edge
          const fromId = typeof nId === 'object' && nId.toNumber ? nId.toNumber() : parseInt(nId.toString());
          const toId = typeof mId === 'object' && mId.toNumber ? mId.toNumber() : parseInt(mId.toString());
          const edgeKey = `${fromId}-${rType}-${toId}`;
          
          if (!edgesSet.has(edgeKey)) {
            edgesSet.add(edgeKey);
            edges.push({
              from: fromId,
              to: toId,
              label: rType || 'RELATED',
              type: rType || 'RELATED',
              properties: rProperties || {},
            });
          }
        }
      }

      const nodes = Array.from(nodesMap.values());

      const response = {
        success: true,
        network: {
          nodes,
          edges,
        },
        metadata: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          limit,
          filters: {
            labels,
            relationships,
          },
        },
      };

      ctx.logger.debug(`[GRAPH-ADMIN-NETWORK] Returning ${nodes.length} nodes and ${edges.length} edges (admin view)`);
      return response;
    } catch (error) {
      ctx.logger.error('[GRAPH-ADMIN-NETWORK] Error querying network:', error);
      throw new Error(`Failed to query admin knowledge graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await session.close();
    }
  });
