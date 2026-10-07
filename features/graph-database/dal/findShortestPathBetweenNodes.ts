import { getGraphDatabaseSource } from '@/features/graph-database';
import { NeighborNode, NeighborEdge } from '@/features/graph-database/dal/getNodeNeighbors';
import { expandIdentityClusters } from '@/features/graph-database/dal/expandIdentityClusters';
import { FORBIDDEN_REL_TYPES } from '@/features/graph-database/services/cypherUtils';
import { logger } from '@/server/logger';

export interface ShortestPathPair {
  startNeoId: number;
  endNeoId: number;
  nodes: NeighborNode[];
  edges: NeighborEdge[];
}

export interface ShortestPathBetweenNodesResult {
  paths: ShortestPathPair[];
  noPathPairs: Array<{ startNeoId: number; endNeoId: number }>;
}

const FORBIDDEN_REL_TYPES_CYPHER = FORBIDDEN_REL_TYPES.map(
  (relationshipType) => `'${relationshipType}'`,
).join(', ');

export async function findShortestPathBetweenNodes({
  documentIds,
  nodeNeoIds,
  maxDepth = 5,
}: {
  documentIds: string[];
  nodeNeoIds: number[];
  maxDepth?: number;
}): Promise<ShortestPathBetweenNodesResult> {
  const graphDb = await getGraphDatabaseSource();

  const toNumber = (val: any): number => {
    if (val === null || val === undefined) {return 0;}
    if (typeof val === 'object' && val.toNumber) {return val.toNumber();}
    return parseInt(val.toString(), 10);
  };

  // Phase 0: expand each requested node to its full IDENTITY cluster. This DAL
  // keys off Neo4j internal ids (id(n)), while expandIdentityClusters works on
  // the `id` property, so ids are mapped in both directions around the call.
  const uniqueNeoIds = [...new Set(nodeNeoIds)];
  const neoIdToNodeId = new Map<number, string>();
  if (uniqueNeoIds.length > 0) {
    const idResult = await graphDb.run(
      'MATCH (n) WHERE id(n) IN $neoIds RETURN id(n) AS neoId, n.id AS nodeId',
      { neoIds: uniqueNeoIds }
    );
    for (const record of idResult.records) {
      neoIdToNodeId.set(toNumber(record.get('neoId')), record.get('nodeId') as string);
    }
  }

  const nodeIds = [...new Set(neoIdToNodeId.values())];
  const clusterMap = await expandIdentityClusters(nodeIds, documentIds);

  const allExpandedNodeIds = [...new Set(Array.from(clusterMap.values()).flat())];
  const nodeIdToNeoId = new Map<string, number>();
  if (allExpandedNodeIds.length > 0) {
    const neoResult = await graphDb.run(
      'MATCH (n) WHERE n.id IN $nodeIds RETURN n.id AS nodeId, id(n) AS neoId',
      { nodeIds: allExpandedNodeIds }
    );
    for (const record of neoResult.records) {
      nodeIdToNeoId.set(record.get('nodeId') as string, toNumber(record.get('neoId')));
    }
  }

  // Resolve a single requested neoId to the neoIds of every member of its
  // IDENTITY cluster (itself included). Falls back to just itself when the
  // node has no `id` property mapping or no cluster membership was found.
  const expandedNeoIds = (originalNeoId: number): number[] => {
    const nodeId = neoIdToNodeId.get(originalNeoId);
    if (!nodeId) {return [originalNeoId];}
    const clusterIds = clusterMap.get(nodeId) ?? [nodeId];
    const mapped = clusterIds
      .map((id) => nodeIdToNeoId.get(id))
      .filter((id): id is number => id !== undefined);
    return mapped.length > 0 ? mapped : [originalNeoId];
  };

  // Generate all unique pairs
  const pairs: Array<{ startId: number; endId: number }> = [];
  for (let i = 0; i < nodeNeoIds.length; i++) {
    for (let j = i + 1; j < nodeNeoIds.length; j++) {
      pairs.push({ startId: nodeNeoIds[i], endId: nodeNeoIds[j] });
    }
  }

  const paths: ShortestPathPair[] = [];
  const noPathPairs: Array<{ startNeoId: number; endNeoId: number }> = [];

  // Run each pair sequentially with its own session to avoid
  // "open transaction" errors from concurrent queries on a single session
  for (const { startId, endId } of pairs) {
    const startNeoIds = expandedNeoIds(startId);
    const endNeoIds = expandedNeoIds(endId);
    const session = await graphDb.getSession();
    try {
      // Try every (expanded start, expanded end) combination and keep only the
      // globally shortest path, then expand its nodes/edges. id(a) <> id(b)
      // guards the case where start and end land in the same IDENTITY cluster.
      // Try semantic-only path first (no Chunk/Document intermediate nodes)
      const semanticQuery = `
        UNWIND $startNeoIds AS sId
        UNWIND $endNeoIds AS eId
        MATCH (a), (b)
        WHERE id(a) = sId AND id(b) = eId AND id(a) <> id(b)
        MATCH p = shortestPath((a)-[*1..${maxDepth}]-(b))
        WHERE none(r IN relationships(p) WHERE type(r) IN [${FORBIDDEN_REL_TYPES_CYPHER}])
          AND all(n IN nodes(p) WHERE
            (n.documentId IN $documentIds OR (n:Document AND n.id IN $documentIds))
            AND NOT n:Chunk AND NOT n:Document)
        WITH p, length(p) AS pathLength
        ORDER BY pathLength ASC
        LIMIT 1
        UNWIND nodes(p) AS node
        WITH p, node
        OPTIONAL MATCH (node)-[r]-(other)
        WHERE other IN nodes(p)
        RETURN
          collect(DISTINCT {
            neoId: id(node),
            labels: labels(node),
            properties: properties(node)
          }) AS pathNodes,
          collect(DISTINCT {
            fromNeoId: id(startNode(r)),
            toNeoId: id(endNode(r)),
            type: type(r),
            properties: properties(r)
          }) AS pathEdges
      `;

      // Fallback: allow Chunk/Document nodes if semantic path not found
      const fullQuery = `
        UNWIND $startNeoIds AS sId
        UNWIND $endNeoIds AS eId
        MATCH (a), (b)
        WHERE id(a) = sId AND id(b) = eId AND id(a) <> id(b)
        MATCH p = shortestPath((a)-[*1..${maxDepth}]-(b))
        WHERE none(r IN relationships(p) WHERE type(r) IN [${FORBIDDEN_REL_TYPES_CYPHER}])
          AND all(n IN nodes(p) WHERE
            (n.documentId IN $documentIds OR (n:Document AND n.id IN $documentIds)))
        WITH p, length(p) AS pathLength
        ORDER BY pathLength ASC
        LIMIT 1
        UNWIND nodes(p) AS node
        WITH p, node
        OPTIONAL MATCH (node)-[r]-(other)
        WHERE other IN nodes(p)
        RETURN
          collect(DISTINCT {
            neoId: id(node),
            labels: labels(node),
            properties: properties(node)
          }) AS pathNodes,
          collect(DISTINCT {
            fromNeoId: id(startNode(r)),
            toNeoId: id(endNode(r)),
            type: type(r),
            properties: properties(r)
          }) AS pathEdges
      `;

      let result = await session.run(semanticQuery, { startNeoIds, endNeoIds, documentIds });

      // Fall back to full path if semantic-only found nothing
      if (result.records.length === 0 || !result.records[0].get('pathNodes')?.length) {
        result = await session.run(fullQuery, { startNeoIds, endNeoIds, documentIds });
      }

      if (result.records.length === 0) {
        noPathPairs.push({ startNeoId: startId, endNeoId: endId });
        continue;
      }

      const record = result.records[0];
      const rawNodes = record.get('pathNodes') || [];
      const rawEdges = record.get('pathEdges') || [];

      const nodesMap = new Map<number, NeighborNode>();
      for (const rn of rawNodes) {
        const id = toNumber(rn.neoId);
        if (nodesMap.has(id)) {continue;}
        const labels = rn.labels || [];
        const props = rn.properties || {};
        const primaryLabel = labels.length > 0 ? labels[0] : 'Node';
        const label = props.name || props.title || props.id || `${primaryLabel}-${id}`;
        nodesMap.set(id, { id, label, labels, properties: props, group: primaryLabel });
      }

      const edgesMap = new Map<string, NeighborEdge>();
      for (const re of rawEdges) {
        if (!re.type) {continue;}
        const fromId = toNumber(re.fromNeoId);
        const toId = toNumber(re.toNeoId);
        const sorted = [fromId, toId].sort((a, b) => a - b);
        const edgeKey = `${sorted[0]}-${re.type}-${sorted[1]}`;
        if (edgesMap.has(edgeKey)) {continue;}
        edgesMap.set(edgeKey, {
          from: fromId,
          to: toId,
          label: re.type,
          type: re.type,
          properties: re.properties || {},
        });
      }

      paths.push({
        startNeoId: startId,
        endNeoId: endId,
        nodes: Array.from(nodesMap.values()),
        edges: Array.from(edgesMap.values()),
      });
    } catch (error) {
      logger.warn('[SHORTEST-PATH] Pair query failed', { startId, endId, error });
      noPathPairs.push({ startNeoId: startId, endNeoId: endId });
    } finally {
      await session.close();
    }
  }

  logger.info('[SHORTEST-PATH] Between nodes complete', {
    totalPairs: pairs.length,
    pathsFound: paths.length,
    noPathPairs: noPathPairs.length,
  });

  return { paths, noPathPairs };
}
