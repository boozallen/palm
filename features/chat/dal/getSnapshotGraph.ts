import db from '@/server/db';
import logger from '@/server/logger';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { expandIdentityClusters } from '@/features/graph-database/dal/expandIdentityClusters';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

export type GetSnapshotGraphInput = Readonly<{
  snapshotId: string;
  accessibleDocIds: AccessibleDocIds;
}>;

export type SnapshotNode = {
  id: number;
  label: string;
  labels: string[];
  properties: Record<string, any>;
  group: string;
  isAnchor: boolean;
};

export type SnapshotEdge = {
  from: number;
  to: number;
  label: string;
  type: string;
  properties: Record<string, any>;
  isShortestPath: boolean;
};

export type SnapshotGraphResult = {
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    documentIds: string[];
    nodeIds: string[];
  };
  snapshot: {
    id: string;
    chatMessageId: string;
    nodeIds: string[];
    documentIds: string[];
    positions: Record<string, { x: number; y: number }> | null;
    createdAt: Date;
    questionContent: string;
  };
};

const toNumber = (val: any): number => {
  if (val === null || val === undefined) {
    return 0;
  }
  if (typeof val === 'object' && val.toNumber) {
    return val.toNumber();
  }
  return parseInt(val.toString(), 10);
};

export default async function getSnapshotGraph(
  input: GetSnapshotGraphInput
): Promise<SnapshotGraphResult> {
  let snapshot;
  try {
    snapshot = await db.graphSnapshot.findUnique({
      where: { id: input.snapshotId },
      include: {
        message: {
          include: {
            chat: true,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error loading graph snapshot', { snapshotId: input.snapshotId, error });
    throw new Error('Error loading graph snapshot');
  }

  if (!snapshot) {
    throw new Error('Snapshot not found');
  }

  if (snapshot.nodeIds.length === 0) {
    return {
      nodes: [],
      edges: [],
      metadata: {
        nodeCount: 0,
        edgeCount: 0,
        documentIds: snapshot.documentIds,
        nodeIds: snapshot.nodeIds,
      },
      snapshot: {
        id: snapshot.id,
        chatMessageId: snapshot.chatMessageId,
        nodeIds: snapshot.nodeIds,
        documentIds: snapshot.documentIds,
        positions:
          (snapshot.positions as Record<string, { x: number; y: number }> | null) ?? null,
        createdAt: snapshot.createdAt,
        questionContent: snapshot.message.content,
      },
    };
  }

  // Fetch exactly the snapshot's nodes (no bridges, no 1-hop expansion) plus
  // the edges between them. createGraphSnapshot persists node ids only, so
  // ALL edges here — direct or IDENTITY-cluster-implied — are re-derived at
  // read time, not a faithful replay of exact edges seen at submit time. If
  // the underlying graph changes between submit and view, the direct-edge set
  // can drift too; only the node membership is a true snapshot. Persisting
  // edges at snapshot time would close that gap — tracked separately, not
  // solved here.
  const graphDb = await getGraphDatabaseSource();

  const accessibleDocIdsArray = Array.from(input.accessibleDocIds);

  const nodesQuery = `
    MATCH (n)
    WHERE n.id IN $nodeIds
      AND (n.documentId IN $accessibleDocIds OR (n:Document AND n.id IN $accessibleDocIds))
    RETURN
      labels(n) AS nodeLabels,
      id(n) AS neoId,
      properties(n) AS props
  `;

  const edgesQuery = `
    MATCH (a)-[r]-(b)
    WHERE a.id IN $nodeIds
      AND b.id IN $nodeIds
      AND (a.documentId IN $accessibleDocIds OR (a:Document AND a.id IN $accessibleDocIds))
      AND (b.documentId IN $accessibleDocIds OR (b:Document AND b.id IN $accessibleDocIds))
      AND id(a) < id(b)
    RETURN DISTINCT
      type(r) AS rType,
      properties(r) AS rProps,
      id(startNode(r)) AS rFromNeoId,
      id(endNode(r)) AS rToNeoId
  `;

  let nodesResult;
  let edgesResult;
  try {
    [nodesResult, edgesResult] = await Promise.all([
      graphDb.run(nodesQuery, { nodeIds: snapshot.nodeIds, accessibleDocIds: accessibleDocIdsArray }),
      graphDb.run(edgesQuery, { nodeIds: snapshot.nodeIds, accessibleDocIds: accessibleDocIdsArray }),
    ]);
  } catch (error) {
    logger.error('Error querying snapshot nodes/edges from graph database', {
      snapshotId: input.snapshotId,
      error,
    });
    throw new Error('Error loading snapshot graph');
  }

  const propIdToNeoId = new Map<string, number>();
  const nodes: SnapshotNode[] = nodesResult.records.map((record: any) => {
    const neoId = toNumber(record.get('neoId'));
    const labels = (record.get('nodeLabels') as string[]) ?? [];
    const props = (record.get('props') as Record<string, any>) ?? {};
    const primaryLabel = labels[0] ?? 'Node';
    let displayLabel = props.name ?? props.title ?? `${primaryLabel}-${neoId}`;
    if (labels.includes('Document') || labels.includes('Chunk')) {
      displayLabel = '';
    }
    if (props.id) {
      propIdToNeoId.set(props.id, neoId);
    }
    return {
      id: neoId,
      label: displayLabel,
      labels,
      properties: props,
      group: primaryLabel,
      isAnchor: true,
    };
  });

  const edges: SnapshotEdge[] = edgesResult.records.map((record: any) => {
    const rType = (record.get('rType') as string) ?? 'RELATED';
    const rProps = (record.get('rProps') as Record<string, any>) ?? {};
    const fromId = toNumber(record.get('rFromNeoId'));
    const toId = toNumber(record.get('rToNeoId'));
    // Match live-canvas label logic: the specific predicate lives in the
    // relationType property; Neo4j's type(r) is a generic fallback ("RELATED").
    const displayLabel = (rProps.relationType as string | undefined) || rType;
    return {
      from: fromId,
      to: toId,
      label: displayLabel,
      type: rType,
      properties: rProps,
      isShortestPath: false,
    };
  });

  // Two snapshot nodes can be in the same IDENTITY cluster without a direct
  // edge (see expandIdentityClusters) — synthesize the missing edge so the
  // canvas still renders them as connected, restoring the pre-snapshot visual.
  if (snapshot.nodeIds.length > 1) {
    const clusterMap = await expandIdentityClusters(snapshot.nodeIds, accessibleDocIdsArray);
    const existingEdgeKeys = new Set(edges.map((e) => `${Math.min(e.from, e.to)}-${Math.max(e.from, e.to)}`));

    for (let i = 0; i < snapshot.nodeIds.length; i++) {
      for (let j = i + 1; j < snapshot.nodeIds.length; j++) {
        const idA = snapshot.nodeIds[i];
        const idB = snapshot.nodeIds[j];
        if (!(clusterMap.get(idA) ?? [idA]).includes(idB)) {continue;}

        const neoA = propIdToNeoId.get(idA);
        const neoB = propIdToNeoId.get(idB);
        if (neoA === undefined || neoB === undefined) {continue;}

        const edgeKey = `${Math.min(neoA, neoB)}-${Math.max(neoA, neoB)}`;
        if (existingEdgeKeys.has(edgeKey)) {continue;}
        existingEdgeKeys.add(edgeKey);

        edges.push({
          from: neoA,
          to: neoB,
          label: 'IDENTITY',
          type: 'IDENTITY',
          properties: {},
          isShortestPath: false,
        });
      }
    }
  }

  return {
    nodes,
    edges,
    metadata: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      documentIds: snapshot.documentIds,
      nodeIds: snapshot.nodeIds,
    },
    snapshot: {
      id: snapshot.id,
      chatMessageId: snapshot.chatMessageId,
      nodeIds: snapshot.nodeIds,
      documentIds: snapshot.documentIds,
      positions:
        (snapshot.positions as Record<string, { x: number; y: number }> | null) ?? null,
      createdAt: snapshot.createdAt,
      questionContent: snapshot.message.content,
    },
  };
}
