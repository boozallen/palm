import { getGraphDatabaseSource } from '@/features/graph-database';

export interface NodeNeighborsParams {
  documentIds: string[];
  nodeNeoId: number; // Neo4j internal node ID
}

export interface NeighborNode {
  id: number;
  label: string;
  labels: string[];
  properties: Record<string, any>;
  group: string;
}

export interface NeighborEdge {
  from: number;
  to: number;
  label: string;
  type: string;
  properties: Record<string, any>;
}

export interface NodeNeighborsResult {
  sourceNode: NeighborNode;
  neighbors: NeighborNode[];
  edges: NeighborEdge[];
  metadata: {
    sourceNodeId: number;
    neighborCount: number;
    edgeCount: number;
  };
}

export async function getNodeNeighbors({
  documentIds,
  nodeNeoId,
}: NodeNeighborsParams): Promise<NodeNeighborsResult> {
  const graphDb = await getGraphDatabaseSource();
  const session = await graphDb.getSession();

  try {
    // Step 1: Get source node
    const sourceQuery = `
      MATCH (source)
      WHERE id(source) = $nodeNeoId
        AND (source.documentId IN $documentIds OR (source:Document AND source.id IN $documentIds))
      RETURN source, labels(source) as sourceLabels, id(source) as sourceNeoId, properties(source) as sourceProps
    `;

    // Step 2: Get top 50 unique neighbors prioritized by non-chunk first, then mentionCount
    const neighborsQuery = `
      MATCH (source)--(neighbor)
      WHERE id(source) = $nodeNeoId
        AND (neighbor.documentId IN $documentIds OR (neighbor:Document AND neighbor.id IN $documentIds))
      WITH DISTINCT neighbor
      ORDER BY
        CASE WHEN 'Chunk' IN labels(neighbor) THEN 1 ELSE 0 END ASC,
        coalesce(neighbor.mentionCount, 0) DESC
      LIMIT 50
      RETURN id(neighbor) as neighborNeoId
    `;

    // Step 3: Get all edges between source and the selected neighbors
    const query = `
      MATCH (source)-[r]-(neighbor)
      WHERE id(source) = $nodeNeoId
        AND (source.documentId IN $documentIds OR (source:Document AND source.id IN $documentIds))
        AND id(neighbor) IN $neighborNeoIds

      RETURN
        r,
        type(r) as rType,
        properties(r) as rProps,
        id(startNode(r)) as rFromNeoId,
        id(endNode(r)) as rToNeoId,
        neighbor,
        labels(neighbor) as neighborLabels,
        id(neighbor) as neighborNeoId,
        properties(neighbor) as neighborProps
    `;

    // Run source + neighbor selection queries sequentially (Neo4j sessions don't support concurrent queries)
    const sourceResult = await session.run(sourceQuery, { documentIds, nodeNeoId });
    const neighborIdsResult = await session.run(neighborsQuery, { documentIds, nodeNeoId });

    // Collect the top 50 neighbor IDs
    const topNeighborNeoIds = neighborIdsResult.records.map((r: any) => {
      const val = r.get('neighborNeoId');
      return typeof val === 'object' && val.toNumber ? val.toNumber() : parseInt(val.toString(), 10);
    });

    // Get edges between source and selected neighbors
    const result = topNeighborNeoIds.length > 0
      ? await session.run(query, { nodeNeoId, documentIds, neighborNeoIds: topNeighborNeoIds })
      : { records: [] };

    // Collect neighbor IDs for inter-neighbor edge query
    const neighborNeoIds: number[] = [];
    for (const record of result.records) {
      const neighborNeoId = record.get('neighborNeoId');
      if (neighborNeoId) {
        const id = typeof neighborNeoId === 'object' && neighborNeoId.toNumber
          ? neighborNeoId.toNumber()
          : parseInt(neighborNeoId.toString(), 10);
        if (!neighborNeoIds.includes(id)) {
          neighborNeoIds.push(id);
        }
      }
    }

    // Query for edges between neighbors (inter-neighbor edges)
    let interNeighborResult: any = { records: [] };
    if (neighborNeoIds.length > 1) {
      const interNeighborQuery = `
        MATCH (n1)-[r]-(n2)
        WHERE id(n1) IN $neighborNeoIds
          AND id(n2) IN $neighborNeoIds
          AND id(n1) < id(n2)
        RETURN
          r,
          type(r) as rType,
          properties(r) as rProps,
          id(startNode(r)) as rFromNeoId,
          id(endNode(r)) as rToNeoId
      `;
      interNeighborResult = await session.run(interNeighborQuery, { neighborNeoIds });
    }

    // Helper to safely convert Neo4j integer to number
    const toNumber = (val: any): number => {
      if (val === null || val === undefined) {
        return 0;
      }
      if (typeof val === 'object' && val.toNumber) {
        return val.toNumber();
      }
      return parseInt(val.toString(), 10);
    };

    // Parse source node from dedicated query
    let sourceNode: NeighborNode | null = null;
    if (sourceResult.records.length > 0) {
      const record = sourceResult.records[0];
      const sourceNeoId = record.get('sourceNeoId');
      const sourceLabels = record.get('sourceLabels');
      const sourceProps = record.get('sourceProps');

      if (sourceNeoId) {
        const id = toNumber(sourceNeoId);
        const primaryLabel = sourceLabels && sourceLabels.length > 0 ? sourceLabels[0] : 'Node';
        const nodeLabel = sourceProps?.name || sourceProps?.title || sourceProps?.id || `${primaryLabel}-${id}`;

        sourceNode = {
          id,
          label: nodeLabel,
          labels: sourceLabels || [],
          properties: sourceProps || {},
          group: primaryLabel,
        };
      }
    }

    const neighborsMap = new Map<string, NeighborNode>();
    const edgesMap = new Map<string, NeighborEdge>();

    for (const record of result.records) {
      // Get neighbor and edge
      const neighbor = record.get('neighbor');
      const r = record.get('r');

      if (neighbor && r) {
        const neighborNeoId = record.get('neighborNeoId');
        const neighborLabels = record.get('neighborLabels');
        const neighborProps = record.get('neighborProps');
        const rType = record.get('rType');
        const rProps = record.get('rProps');
        const rFromNeoId = record.get('rFromNeoId');
        const rToNeoId = record.get('rToNeoId');

        const neighborId = toNumber(neighborNeoId);
        const fromId = toNumber(rFromNeoId);
        const toId = toNumber(rToNeoId);
        const neighborKey = neighborId.toString();

        // Add neighbor node
        if (!neighborsMap.has(neighborKey)) {
          const primaryLabel = neighborLabels && neighborLabels.length > 0 ? neighborLabels[0] : 'Node';
          const nodeLabel = neighborProps?.name || neighborProps?.title || neighborProps?.id || `${primaryLabel}-${neighborId}`;

          neighborsMap.set(neighborKey, {
            id: neighborId,
            label: nodeLabel,
            labels: neighborLabels || [],
            properties: neighborProps || {},
            group: primaryLabel,
          });
        }

        // Add edge (deduplicated) - use actual relationship direction from Neo4j
        const nodeIds = [fromId, toId].sort((a, b) => a - b);
        const edgeKey = `${nodeIds[0]}-${rType}-${nodeIds[1]}`;

        if (!edgesMap.has(edgeKey)) {
          edgesMap.set(edgeKey, {
            from: fromId,
            to: toId,
            label: rType || 'RELATED',
            type: rType || 'RELATED',
            properties: rProps || {},
          });
        }
      }
    }

    if (!sourceNode) {
      throw new Error('Source node not found or not accessible');
    }

    // Process inter-neighbor edges
    for (const record of interNeighborResult.records) {
      const rType = record.get('rType');
      const rProps = record.get('rProps');
      const rFromNeoId = record.get('rFromNeoId');
      const rToNeoId = record.get('rToNeoId');

      const fromId = toNumber(rFromNeoId);
      const toId = toNumber(rToNeoId);

      // Add edge (deduplicated)
      const nodeIds = [fromId, toId].sort((a, b) => a - b);
      const edgeKey = `${nodeIds[0]}-${rType}-${nodeIds[1]}`;

      if (!edgesMap.has(edgeKey)) {
        edgesMap.set(edgeKey, {
          from: fromId,
          to: toId,
          label: rType || 'RELATED',
          type: rType || 'RELATED',
          properties: rProps || {},
        });
      }
    }

    const neighbors = Array.from(neighborsMap.values());
    const edges = Array.from(edgesMap.values());

    return {
      sourceNode,
      neighbors,
      edges,
      metadata: {
        sourceNodeId: nodeNeoId,
        neighborCount: neighbors.length,
        edgeCount: edges.length,
      },
    };
  } finally {
    await session.close();
  }
}
