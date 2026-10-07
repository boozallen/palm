import { getGraphDatabaseSource } from '@/features/graph-database';

export interface GetEdgesBetweenParams {
  documentIds: string[];
  newNodeNeoIds: number[];
  existingNodeNeoIds: number[];
}

export interface CrossEdge {
  from: number;
  to: number;
  label: string;
  type: string;
  properties: Record<string, any>;
}

export interface GetEdgesBetweenResult {
  edges: CrossEdge[];
  metadata: {
    edgeCount: number;
  };
}

export async function getEdgesBetween({
  documentIds,
  newNodeNeoIds,
  existingNodeNeoIds,
}: GetEdgesBetweenParams): Promise<GetEdgesBetweenResult> {
  if (newNodeNeoIds.length === 0 || existingNodeNeoIds.length === 0) {
    return { edges: [], metadata: { edgeCount: 0 } };
  }

  const graphDb = await getGraphDatabaseSource();
  const session = await graphDb.getSession();

  try {
    const query = `
      MATCH (a)-[r]-(b)
      WHERE id(a) IN $newNodeNeoIds AND id(b) IN $existingNodeNeoIds
        AND (a.documentId IN $documentIds OR (a:Document AND a.id IN $documentIds))
        AND (b.documentId IN $documentIds OR (b:Document AND b.id IN $documentIds))
      RETURN DISTINCT
        type(r) AS rType,
        properties(r) AS rProps,
        id(startNode(r)) AS rFromNeoId,
        id(endNode(r)) AS rToNeoId
    `;

    const result = await session.run(query, {
      documentIds,
      newNodeNeoIds,
      existingNodeNeoIds,
    });

    const toNumber = (val: any): number => {
      if (val === null || val === undefined) {
        return 0;
      }
      if (typeof val === 'object' && val.toNumber) {
        return val.toNumber();
      }
      return parseInt(val.toString(), 10);
    };

    const edgesMap = new Map<string, CrossEdge>();

    for (const record of result.records) {
      const rType = record.get('rType');
      const rProps = record.get('rProps');
      const fromId = toNumber(record.get('rFromNeoId'));
      const toId = toNumber(record.get('rToNeoId'));

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

    const edges = Array.from(edgesMap.values());

    return {
      edges,
      metadata: {
        edgeCount: edges.length,
      },
    };
  } finally {
    await session.close();
  }
}
