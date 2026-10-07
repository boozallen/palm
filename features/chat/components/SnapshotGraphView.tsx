import { useEffect, useRef } from 'react';
import { Network, Options } from 'vis-network';
import { DataSet } from 'vis-data';
import { Box } from '@mantine/core';

type SnapshotGraphNode = {
  id: number;
  label: string;
  labels: string[];
  properties: Record<string, any>;
  group: string;
  isAnchor: boolean;
};

type SnapshotGraphEdge = {
  from: number;
  to: number;
  label: string;
  type: string;
  properties: Record<string, any>;
  isShortestPath: boolean;
};

type SnapshotGraphViewProps = {
  nodes: SnapshotGraphNode[];
  edges: SnapshotGraphEdge[];
  height?: number | string;
};

// Match the live canvas color scheme from GraphVisualization.formatNode
const NODE_COLORS = {
  Entity: '#96CEB4',
  Concept: '#45B7D1',
  Default: '#DDA0DD',
} as const;

const CHUNK_COLOR_PALETTE = [
  '#CC7EB8',
  '#E57373',
  '#9575CD',
  '#FF8C42',
  '#64B5F6',
  '#4DB6AC',
  '#FFD54F',
  '#81C784',
  '#A1887F',
  '#4DD0E1',
];

function getColorIndexFromDocId(docId: string): number {
  let hash = 0;
  for (let i = 0; i < docId.length; i++) {
    const char = docId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % CHUNK_COLOR_PALETTE.length;
}

function darkenHex(hex: string, percent = 25): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
  const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(2.55 * percent));
  const b = Math.max(0, (num & 0x0000ff) - Math.round(2.55 * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function buildDocumentColorMap(nodes: SnapshotGraphNode[]): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();

  const docIds = Array.from(
    new Set(
      nodes
        .filter((n) => n.properties?.documentId && !n.labels?.includes('Document'))
        .map((n) => n.properties.documentId as string),
    ),
  );

  for (const docId of docIds) {
    let idx = getColorIndexFromDocId(docId);
    let color = CHUNK_COLOR_PALETTE[idx];
    let attempts = 0;
    while (used.has(color) && attempts < CHUNK_COLOR_PALETTE.length) {
      idx = (idx + 1) % CHUNK_COLOR_PALETTE.length;
      color = CHUNK_COLOR_PALETTE[idx];
      attempts++;
    }
    map.set(docId, color);
    used.add(color);
  }

  for (const node of nodes) {
    if (node.labels?.includes('Document')) {
      const docId = node.properties?.id as string | undefined;
      if (docId && !map.has(docId)) {
        let idx = getColorIndexFromDocId(docId);
        let color = CHUNK_COLOR_PALETTE[idx];
        let attempts = 0;
        while (used.has(color) && attempts < CHUNK_COLOR_PALETTE.length) {
          idx = (idx + 1) % CHUNK_COLOR_PALETTE.length;
          color = CHUNK_COLOR_PALETTE[idx];
          attempts++;
        }
        map.set(docId, color);
        used.add(color);
      }
    }
  }

  return map;
}

function pickLabel(node: SnapshotGraphNode): string {
  const isDocument = node.labels?.includes('Document');
  const isChunk = node.labels?.includes('Chunk');
  if (isDocument || isChunk) {
    return '';
  }
  const props = node.properties ?? {};
  let label: string;
  if (props.name) {
    label = props.name;
  } else if (props.title) {
    label = props.title;
  } else if (props.filename) {
    label = String(props.filename).split('/').pop()?.split('.').shift() || props.filename;
  } else if (props.source) {
    label = props.source;
  } else {
    label = node.labels?.[0] || `Node ${node.id}`;
  }
  if (label.length > 25) {
    label = label.substring(0, 22) + '...';
  }
  return label;
}

function formatNodeForVis(
  node: SnapshotGraphNode,
  documentColorMap: Map<string, string>,
): Record<string, any> {
  const isDocument = node.labels?.includes('Document');
  const isChunk = node.labels?.includes('Chunk');
  const isEntity = node.labels?.includes('Entity');
  const isConcept = node.labels?.includes('Concept');

  // Color
  let nodeColor: string;
  if (isDocument) {
    const docId = node.properties?.id as string | undefined;
    nodeColor = (docId && documentColorMap.get(docId)) || NODE_COLORS.Default;
  } else if (isChunk) {
    const chunkDocId = node.properties?.documentId as string | undefined;
    nodeColor = (chunkDocId && documentColorMap.get(chunkDocId)) || NODE_COLORS.Default;
  } else if (isEntity) {
    nodeColor = NODE_COLORS.Entity;
  } else if (isConcept) {
    nodeColor = NODE_COLORS.Concept;
  } else {
    nodeColor = NODE_COLORS.Default;
  }
  const borderColor = darkenHex(nodeColor, 25);

  // Shape + size
  let shapeStyle: Record<string, any>;
  if (isDocument) {
    shapeStyle = {
      color: { background: '#FFFFFF', border: borderColor },
      shape: 'box',
      widthConstraint: { minimum: 20, maximum: 20 },
      heightConstraint: { minimum: 30 },
      borderWidth: 2,
      shapeProperties: { borderRadius: 0 },
    };
  } else if (isChunk) {
    shapeStyle = {
      color: { background: nodeColor, border: borderColor },
      shape: 'square',
      size: 8,
      borderWidth: 2,
    };
  } else {
    const mentionCount = (node.properties?.mentionCount as number | undefined) ?? 1;
    let nodeSize: number;
    if (mentionCount > 50) {
      nodeSize = 40;
    } else if (mentionCount > 15) {
      nodeSize = 30;
    } else if (mentionCount > 3) {
      nodeSize = 20;
    } else {
      nodeSize = 12;
    }
    shapeStyle = {
      color: { background: nodeColor, border: borderColor },
      shape: 'dot',
      size: nodeSize,
      borderWidth: 2,
    };
  }

  return {
    id: node.id,
    label: pickLabel(node),
    title: node.labels.join(', '),
    ...shapeStyle,
  };
}

const networkOptions: Options = {
  nodes: {
    font: { size: 12, color: '#e9ecef' },
  },
  edges: {
    width: 1,
    color: { color: '#868e96', highlight: '#ffd43b' },
    smooth: { enabled: true, type: 'continuous', roundness: 0.5 },
    arrows: { to: { enabled: true, scaleFactor: 0.5 } },
    font: { size: 10, color: '#adb5bd', strokeWidth: 0 },
  },
  physics: {
    enabled: true,
    stabilization: { enabled: true, iterations: 200 },
    barnesHut: {
      gravitationalConstant: -8000,
      centralGravity: 0.3,
      springLength: 120,
      springConstant: 0.04,
      damping: 0.09,
    },
  },
  interaction: {
    dragNodes: true,
    dragView: true,
    zoomView: true,
    hover: true,
    selectable: true,
    selectConnectedEdges: false,
    multiselect: false,
  },
};

export default function SnapshotGraphView({
  nodes,
  edges,
  height = '100%',
}: SnapshotGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const documentColorMap = buildDocumentColorMap(nodes);

    const visNodes = new DataSet(nodes.map((n) => formatNodeForVis(n, documentColorMap)));

    // Deduplicate edges by (sorted node pair, type) — multiple relationship instances of
    // the same type between the same nodes would otherwise collide on the DataSet ID.
    const seenEdgeKeys = new Set<string>();
    const dedupedEdges: typeof edges = [];
    for (const edge of edges) {
      const sortedIds = [edge.from, edge.to].sort((a, b) => a - b);
      const key = `${sortedIds[0]}-${sortedIds[1]}-${edge.type}`;
      if (seenEdgeKeys.has(key)) {
        continue;
      }
      seenEdgeKeys.add(key);
      dedupedEdges.push(edge);
    }

    const visEdges = new DataSet(
      dedupedEdges.map((edge) => {
        const sortedIds = [edge.from, edge.to].sort((a, b) => a - b);
        return {
          id: `${sortedIds[0]}-${sortedIds[1]}-${edge.type}`,
          from: edge.from,
          to: edge.to,
          label: edge.label,
        };
      }),
    );

    networkRef.current = new Network(
      containerRef.current,
      { nodes: visNodes, edges: visEdges },
      networkOptions,
    );

    networkRef.current.once('stabilizationIterationsDone', () => {
      networkRef.current?.fit();
    });

    return () => {
      networkRef.current?.destroy();
      networkRef.current = null;
    };
  }, [nodes, edges]);

  return (
    <Box
      ref={containerRef}
      sx={(theme) => ({
        width: '100%',
        height,
        backgroundColor: theme.colors.dark[7],
        borderRadius: theme.radius.sm,
      })}
    />
  );
}
