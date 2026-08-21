import { getGraphDatabaseSource } from '@/features/graph-database';

export interface ChatNetworkNode {
  id: number;
  label: string;
  labels: string[];
  properties: Record<string, any>;
  group: string;
}

export interface ChatNetworkEdge {
  from: number;
  to: number;
  label: string;
  type: string;
  properties: Record<string, any>;
}

export interface ChatNetworkParams {
  documentIds: string[];
  limit?: number;
  labels?: string[];
  relationships?: string[];
}

export interface ChatNetworkResult {
  nodes: ChatNetworkNode[];
  edges: ChatNetworkEdge[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    limit: number;
    documentIds: string[];
    filters: {
      labels: string[];
      relationships: string[];
    };
  };
}

export async function getChatNetwork({
  documentIds,
  limit = 200,
  labels = [],
  relationships = [],
}: ChatNetworkParams): Promise<ChatNetworkResult> {
  const actualLimit = Math.min(limit, 1000);

  const graphDb = await getGraphDatabaseSource();

  const documentFilter = 'WHERE ((n.documentId IN $documentIds) OR (n:Document AND n.id IN $documentIds))';
    
    // Build additional filters
    let additionalNodeFilter = '';
    let relationshipFilter = '';
    
    if (labels.length > 0) {
      const labelConditions = labels.map(label => `'${label}' IN labels(n)`).join(' OR ');
      additionalNodeFilter = ` AND (${labelConditions})`;
    }

    if (relationships.length > 0) {
      const relConditions = relationships.map(rel => `type(r) = '${rel}'`).join(' OR ');
      relationshipFilter = `WHERE ${relConditions}`;
    }

    // Query for nodes and relationships filtered by documentIds and userId
    const networkQuery = `
      MATCH (n)
      ${documentFilter}${additionalNodeFilter}
      WITH n
      LIMIT ${actualLimit}
      WITH collect(n) as limitedNodes
      UNWIND limitedNodes as n
      OPTIONAL MATCH (n)-[r]-(m)
      WHERE m IN limitedNodes
      ${relationshipFilter ? 'AND (' + relationships.map(rel => `type(r) = '${rel}'`).join(' OR ') + ')' : ''}

      RETURN
        n,
        labels(n) as nLabels,
        properties(n) as nProperties,
        id(n) as nId,
        r,
        type(r) as rType,
        properties(r) as rProperties,
        id(startNode(r)) as rFromId,
        id(endNode(r)) as rToId,
        m,
        labels(m) as mLabels,
        properties(m) as mProperties,
        id(m) as mId
    `;

    // Separate query for Document nodes (for legend display)
    // These may not be in the limited result set but we need them for metadata
    const documentNodesQuery = `
      MATCH (doc:Document)
      WHERE doc.id IN $documentIds
      RETURN
        labels(doc) as nLabels,
        properties(doc) as nProperties,
        id(doc) as nId
    `;

  const [result, documentResult] = await Promise.all([
    graphDb.run(networkQuery, { documentIds }),
    graphDb.run(documentNodesQuery, { documentIds }),
  ]);

    // Process nodes and relationships
    const nodesMap = new Map<string, ChatNetworkNode>();
    const edgesSet = new Set<string>();
    const edges: ChatNetworkEdge[] = [];

    for (const record of result.records) {
      const nId = record.get('nId');
      const nLabels = record.get('nLabels');
      const nProperties = record.get('nProperties');

      // Add main node (includes Documents now via the updated filter)
      if (nId && !nodesMap.has(nId.toString())) {
        const primaryLabel = nLabels && nLabels.length > 0 ? nLabels[0] : 'Node';
        const isDocument = nLabels?.includes('Document');
        // For Documents, prefer filename; for others, prefer name/title
        const nodeLabel = isDocument
          ? (nProperties?.filename || nProperties?.name || nProperties?.title || `Document-${nId}`)
          : (nProperties?.name || nProperties?.title || nProperties?.filename || `${primaryLabel}-${nId}`);

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
          const isDocument = mLabels?.includes('Document');
          // For Documents, prefer filename; for others, prefer name/title
          const nodeLabel = isDocument
            ? (mProperties?.filename || mProperties?.name || mProperties?.title || `Document-${mId}`)
            : (mProperties?.name || mProperties?.title || mProperties?.filename || `${primaryLabel}-${mId}`);
          
          nodesMap.set(mId.toString(), {
            id: typeof mId === 'object' && mId.toNumber ? mId.toNumber() : parseInt(mId.toString()),
            label: nodeLabel,
            labels: mLabels || [],
            properties: mProperties || {},
            group: primaryLabel,
          });
        }

        // Add edge - use actual relationship direction from Neo4j
        const rFromId = record.get('rFromId');
        const rToId = record.get('rToId');
        const fromId = typeof rFromId === 'object' && rFromId.toNumber ? rFromId.toNumber() : parseInt(rFromId.toString());
        const toId = typeof rToId === 'object' && rToId.toNumber ? rToId.toNumber() : parseInt(rToId.toString());
        // Use sorted IDs for deduplication key to avoid duplicates regardless of direction
        const sortedIds = [fromId, toId].sort((a, b) => a - b);
        const edgeKey = `${sortedIds[0]}-${rType}-${sortedIds[1]}`;

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

    // Process Document nodes from separate query (for legend display)
    for (const record of documentResult.records) {
      const nId = record.get('nId');
      const nLabels = record.get('nLabels');
      const nProperties = record.get('nProperties');

      if (nId && !nodesMap.has(nId.toString())) {
        const primaryLabel = nLabels && nLabels.length > 0 ? nLabels[0] : 'Node';
        const nodeLabel = nProperties?.filename || nProperties?.name || nProperties?.title || `Document-${nId}`;

        nodesMap.set(nId.toString(), {
          id: typeof nId === 'object' && nId.toNumber ? nId.toNumber() : parseInt(nId.toString()),
          label: nodeLabel,
          labels: nLabels || [],
          properties: nProperties || {},
          group: primaryLabel,
        });
      }
    }

    const nodes = Array.from(nodesMap.values());

    return {
      nodes,
      edges,
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        limit: actualLimit,
        documentIds,
        filters: {
          labels,
          relationships,
        },
      },
    };
}