import { getGraphDatabaseSource } from '@/features/graph-database';

export interface NodeNeighborCountParams {
  documentIds: string[];
  nodeNeoId: number;
}

export interface NodeNeighborCountResult {
  totalNeighbors: number;
}

export async function getNodeNeighborCount({
  documentIds,
  nodeNeoId,
}: NodeNeighborCountParams): Promise<NodeNeighborCountResult> {
  const graphDb = await getGraphDatabaseSource();
  const session = await graphDb.getSession();

  try {
    // Fast COUNT query - just count distinct neighbors
    const query = `
      MATCH (source)-[r]-(neighbor)
      WHERE id(source) = $nodeNeoId
        AND (source.documentId IN $documentIds OR (source:Document AND source.id IN $documentIds))
        AND (neighbor.documentId IN $documentIds OR (neighbor:Document AND neighbor.id IN $documentIds))
      RETURN count(DISTINCT neighbor) as totalNeighbors
    `;

    const result = await session.run(query, { documentIds, nodeNeoId });

    if (result.records.length === 0) {
      return { totalNeighbors: 0 };
    }

    const totalNeighbors = result.records[0].get('totalNeighbors');
    const count = typeof totalNeighbors === 'object' && totalNeighbors.toNumber
      ? totalNeighbors.toNumber()
      : parseInt(totalNeighbors?.toString() || '0', 10);

    return { totalNeighbors: count };
  } finally {
    await session.close();
  }
}
