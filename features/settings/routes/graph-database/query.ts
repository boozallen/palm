import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import queryGraph from '@/features/settings/dal/graph-database/query';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  query: z.string().optional(),
  allowWrite: z.boolean().optional().default(false),
  // Network query options (when query is not provided)
  limit: z.number().optional().default(100),
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
  results: z.array(z.record(z.any())),
  recordCount: z.number(),
  summary: z.object({
    queryType: z.string(),
    executionTime: z.number(),
    counters: z.object({
      nodesCreated: z.number(),
      nodesDeleted: z.number(),
      relationshipsCreated: z.number(),
      relationshipsDeleted: z.number(),
      propertiesSet: z.number(),
      labelsAdded: z.number(),
      labelsRemoved: z.number(),
    }).optional(),
  }),
  // Add network data for non-custom queries
  network: z.object({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
  }).optional(),
});

type SearchOutput = z.infer<typeof outputSchema>;

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const { query, allowWrite, limit: rawLimit, labels, relationships } = input;
    let queryToExecute: string;

    if (query) {
      // Custom query provided
      queryToExecute = query;
    } else {
      // Build network query with strict filtering
      // When labels are selected, only show nodes matching those labels
      // and only edges between matching nodes
      const limit = Math.min(rawLimit, 1000);

      const hasLabelFilter = labels.length > 0;
      const hasRelationshipFilter = relationships.length > 0;

      // :IdentityCluster/:IN_CLUSTER are internal structural plumbing (no
      // documentId, no user-facing content) — this admin view is not
      // documentId-scoped, so every branch below excludes them explicitly
      // rather than relying on the label/relationship filters as protection.
      if (hasLabelFilter) {
        // Strict label filtering: only show nodes with matching labels
        // and only edges between nodes that BOTH match the label filter
        const labelConditions = labels.map(label => `'${label}' IN labels(n)`).join(' OR ');
        const mLabelConditions = labels.map(label => `'${label}' IN labels(m)`).join(' OR ');

        let relationshipTypeFilter = '';
        if (hasRelationshipFilter) {
          const relConditions = relationships.map(rel => `type(r) = '${rel}'`).join(' OR ');
          relationshipTypeFilter = `AND (${relConditions})`;
        }

        queryToExecute = `
          MATCH (n)
          WHERE (${labelConditions}) AND NOT n:IdentityCluster
          WITH n
          LIMIT ${limit}
          OPTIONAL MATCH (n)-[r]-(m)
          WHERE (${mLabelConditions}) AND NOT m:IdentityCluster AND type(r) <> 'IN_CLUSTER' ${relationshipTypeFilter}
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
      } else if (hasRelationshipFilter) {
        // Only relationship filter: show all nodes but only matching edge types
        const relConditions = relationships.map(rel => `type(r) = '${rel}'`).join(' OR ');

        queryToExecute = `
          MATCH (n)-[r]-(m)
          WHERE (${relConditions}) AND NOT n:IdentityCluster AND NOT m:IdentityCluster
          WITH DISTINCT n, r, m
          LIMIT ${limit}
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
      } else {
        // No filters: show general graph sample
        queryToExecute = `
          MATCH (n)
          WHERE NOT n:IdentityCluster
          WITH n
          LIMIT ${limit}
          OPTIONAL MATCH (n)-[r]-(m)
          WHERE (m IS NULL OR NOT m:IdentityCluster) AND (r IS NULL OR type(r) <> 'IN_CLUSTER')
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
      }
    }

    ctx.logger?.debug(`[GRAPH-SEARCH] Generated query: ${queryToExecute}`);
    ctx.logger?.debug('[GRAPH-SEARCH] Input params:', { query, rawLimit, labels, relationships });

    const result = await queryGraph({ query: queryToExecute, allowWrite });

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.ExecuteNeo4jQuery,
      description: `Neo4j query executed (${result.recordCount} record${result.recordCount === 1 ? '' : 's'} returned, write: ${allowWrite})`,
    });

    const output: SearchOutput = {
      results: result.results,
      recordCount: result.recordCount,
      summary: result.summary,
    };

    // Transform results into network format
    if (result.results.length > 0) {
      const nodesMap = new Map();
      const edgesSet = new Set();
      const edges: any[] = [];

      // Helper to extract node ID from various formats
      const extractId = (value: any): number | null => {
        if (value === undefined || value === null) {
          return null;
        }
        if (typeof value === 'object' && value.toNumber) {
          return value.toNumber();
        }
        if (typeof value === 'object' && value.low !== undefined) {
          return value.low; // Neo4j Integer
        }
        if (typeof value === 'number') {
          return value;
        }
        const parsed = parseInt(value.toString());
        return isNaN(parsed) ? null : parsed;
      };

      // Helper to add a node to the map
      const addNode = (id: number, labels: string[], properties: any) => {
        if (!nodesMap.has(id.toString())) {
          const primaryLabel = labels && labels.length > 0 ? labels[0] : 'Node';
          const nodeLabel = properties?.name || properties?.title || properties?.id || `${primaryLabel}-${id}`;
          nodesMap.set(id.toString(), {
            id,
            label: nodeLabel,
            labels: labels || [],
            properties: properties || {},
            group: primaryLabel,
          });
        }
      };

      for (const record of result.results) {
        // For standard network queries: process n, m, r pattern
        if (record.nId !== undefined) {
          const nId = extractId(record.nId);
          if (nId !== null) {
            addNode(nId, record.nLabels, record.nProperties);
          }

          // Process connected node (m) and relationship (r)
          if (record.r && record.m && record.mId !== undefined) {
            const mId = extractId(record.mId);
            if (mId !== null && nId !== null) {
              addNode(mId, record.mLabels, record.mProperties);

              // Add edge
              const edgeKey = `${nId}-${record.rType}-${mId}`;
              if (!edgesSet.has(edgeKey)) {
                edgesSet.add(edgeKey);
                edges.push({
                  from: nId,
                  to: mId,
                  label: record.rType || 'RELATED',
                  type: record.rType || 'RELATED',
                  properties: record.rProperties || {},
                });
              }
            }
          }
        }

        // For custom queries: look for Neo4j node objects in any field
        // Neo4j nodes have identity, labels, and properties
        for (const [_key, value] of Object.entries(record)) {
          if (value && typeof value === 'object' && 'identity' in value && 'labels' in value && 'properties' in value) {
            const nodeObj = value as { identity: any; labels: string[]; properties: any };
            const nodeId = extractId(nodeObj.identity);
            if (nodeId !== null) {
              addNode(nodeId, nodeObj.labels, nodeObj.properties);
            }
          }
        }
      }

      const nodes = Array.from(nodesMap.values());
      if (nodes.length > 0) {
        output.network = {
          nodes,
          edges,
        };
      }
    }

    return output;
  });
