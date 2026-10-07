import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import {
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  MultiSelect,
  NumberInput,
  Textarea,
  Badge,
  Code,
  Loader,
  Grid,
  Box,
  Collapse,
  Divider,
  Indicator,
  ActionIcon,
  ScrollArea,
  Slider,
  Checkbox,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import {
  IconSearch,
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconDeselect,
  IconSelectAll,
  IconX,
  IconRefresh,
  IconRoute,
  IconTrash,
  IconChevronRight,
  IconChevronLeft,
  IconArrowsMaximize,
  IconArrowsDiagonalMinimize2,
  IconFocus2,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';

import useGetOverview from '@/features/settings/api/graph-database/get-overview';
import useQuery from '@/features/settings/api/graph-database/query';
import { useChatNetwork, useNodeNeighbors, useNodeNeighborCount, useFindShortestPath, useEdgesBetween } from '@/features/chat/api/graph-database';
import { GraphNodeLimits } from '@/features/graph-database/types';
import { mergeBaseWithInteractive } from './graphMergeUtils';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { relationshipTypeMatches } from '@/features/chat/utils/graphCitationHelpers';
import { GraphSearchTab } from '@/features/chat/types/message';
import EnumerationTabBar from '@/features/chat/components/EnumerationTabBar';
import { GraphSearchResultData } from '@/features/chat/types/message';
import GraphSearchTable from '@/features/chat/components/GraphSearchTable';
import SubgraphInspector from '@/features/chat/components/SubgraphInspector';
import { buildSelectedSubgraph } from './buildSelectedSubgraph';
import { buildEvidenceSubgraph } from './buildEvidenceSubgraph';
import { allEdgeKeys, edgeToKey } from './graphEdgeKey';
import GraphElementDetail, { GraphElementDocumentInfo } from './GraphElementDetail';

export interface GraphNode {
  id: number;
  label: string;
  labels: string[];
  properties: any;
  group?: string; // Optional - we use explicit colors instead of vis-network groups
  isAnchor?: boolean;
}

export interface GraphEdge {
  from: number;
  to: number;
  label: string;
  type: string;
  properties: any;
  isShortestPath?: boolean;
}

// Edge identity uses properties.relationType when present (JSON-ingested edges store
// their semantic type there while keeping a generic Neo4j type like RELATED), so that
// multiple semantically-distinct edges between the same node pair don't collapse during
// dedup or fail to round-trip through vis-network's DataSet keying.
function getEdgeKey(edge: { from: number; to: number; type: string; properties?: any }): string {
  const semanticType = edge.properties?.relationType || edge.type;
  return `${edge.from}-${edge.to}-${semanticType}`;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Inspect target — what the detail popover is currently reading. Independent of the
// selection (operation) set: it is driven by hover (transient) or a left-click pin.
type InspectTarget = { kind: 'node'; data: GraphNode } | { kind: 'edge'; data: GraphEdge };

// A citation pin request: the UUID-space element to pin plus the message whose answer cited it (so the
// chat can jump to / re-add onto the right turn's graph before the pin lands).
type CitationPinRequest = {
  target: { nodeUuid?: string; edge?: { src: string; relType: string; tgt: string } };
  sourceMessageId: string;
};

interface GraphVisualizationProps {
  // Chat context props - when provided, renders in simplified mode for chat interface
  documentIds?: string[];
  isInChatContext?: boolean;
  // Document name lookup (from sources panel)
  documentNameMap?: Record<string, string>;
  // Enumeration table integration
  enumerationData?: GraphSearchResultData | null;
  selectedEntityIds?: string[];
  tableSelectedEntityIds?: string[];
  onEntitySelectionChange?: (ids: string[]) => void;
  // Multi-tab support
  enumerationTabs?: GraphSearchTab[];
  activeTabId?: string | null;
  onTabChange?: (tabId: string | null) => void;
  onTabClose?: (tabId: string) => void;
  onGraphDisplayedNodesChange?: (entityIds: string[]) => void;
  // Restore the owner's selection to the post-answer default (the cited subset) when the user hits
  // Reset Graph — the node selection lives upstream (graphEntityIds), so the canvas can't restore it
  // alone. Edges are restored locally (selectedEdgeKeys) since they're owned here.
  onResetGraph?: () => void;
}

export default function GraphVisualization({
  documentIds,
  documentNameMap = {},
  isInChatContext = false,
  enumerationData,
  selectedEntityIds,
  onEntitySelectionChange,
  enumerationTabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onGraphDisplayedNodesChange,
  onResetGraph,
}: GraphVisualizationProps = {}) {
  // When enumeration graphData is pre-loaded, always use it for the graph.
  // The enumeration table takes priority — table row selection controls which
  // nodes appear. Citation anchors from prior queries are ignored while
  // the enumeration table is active.
  const usePreloadedGraphData = !!enumerationData?.graphData;
  // Evidence mode: the primary table/canvas show the synthesis-time evidence subgraph, and the
  // per-query results are demoted to a collapsed disclosure. Derived from the data shape, so a
  // payload without an evidence entry (the legacy union) renders exactly as before.
  const evidenceMode = enumerationData?.kind === 'evidence';
  const theme = useMantineTheme();

  // Chat context for View Source functionality (only used in chat context)
  const { setHighlightedCitation, setSourcesSidebarExpanded, graphCitationPin } = useChat();
  const networkRef = useRef<HTMLDivElement>(null);
  const networkInstance = useRef<Network | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const graphDataRef = useRef<GraphData>(graphData); // Ref to avoid stale closure in click handler
  const originalGraphDataRef = useRef<GraphData>({ nodes: [], edges: [] }); // Store original graph for reset
  // Interactive nodes (Connect/Expand) are preserved via isInteractive flag during query rebuilds
  const removedNodeIdsRef = useRef<Set<number>>(new Set()); // Track explicitly removed nodes to prevent re-adding
  const prevSelectedEntityIdsRef = useRef<string[]>([]); // Track previous selection to detect re-adds vs re-renders
  const [customQueryResult, setCustomQueryResult] = useState<any>(null);
  const [selectedNodes, setSelectedNodes] = useState<GraphNode[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<GraphEdge[]>([]);
  const selectedNodeIdsRef = useRef<Set<number>>(new Set()); // Track selected node IDs for click toggle
  const selectedEdgeIdsRef = useRef<Set<string>>(new Set()); // Track selected edge IDs for click toggle
  // Tracks an in-progress node drag. Drag is pure motion: it never changes selection.
  // wasSelected lets chosen.node decide whether to paint the dragged node red
  // (keep red if it was already selected; suppress red if it was not).
  const isDraggingNodeRef = useRef<{ nodeId: number; wasSelected: boolean } | null>(null);
  // The last pin REQUEST object the pin effect has STARTED handling — guards it so a citation click is
  // processed once (new request object) and not when graphData merely re-renders.
  const lastCitationPinRef = useRef<CitationPinRequest | null>(null);
  // A pin request whose cited element isn't on the canvas yet. ChatInterface jumps to the citation's
  // turn / re-adds the removed node, which updates graphData; the retry effect lands the pin once the
  // target appears, or the fallback timer reports a genuinely off-graph citation ([[Q#]] / stale handle).
  const pendingCitationPinRef = useRef<CitationPinRequest | null>(null);
  const citationPinFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnecting, setIsConnecting] = useState(false); // Loading state for Connect button
  const [_connectedPaths, setConnectedPaths] = useState<Map<string, { nodeIds: number[], edgeKeys: string[] }>>(new Map());
  const [hasLoadedNetwork, setHasLoadedNetwork] = useState(false);

  // Inspect channel — the read-detail state, kept separate from the selection set so that
  // reading an element never mutates the operation set. hoveredElement is transient (set on
  // hover, cleared on blur); it drives the right detail pane, overriding the selected element.
  const [hoveredElement, setHoveredElement] = useState<InspectTarget | null>(null);
  // Persistent inspect target — the last-clicked element. Unlike singleSelectionTarget it survives
  // mouse-out AND additional selections, so the detail card stays put while you multi-select for
  // bulk ops (Neo4j-style "active" element). Always points at a currently-selected element.
  const [pinnedElement, setPinnedElement] = useState<InspectTarget | null>(null);
  // Refs the once-registered vis-network handlers read: which element is pinned (so the renderer can
  // draw its 📌 badge), independent of the selection set.
  const pinnedNodeIdRef = useRef<number | null>(null);
  const pinnedEdgeKeyRef = useRef<string | null>(null);

  // Filters and options
  const [limit, setLimit] = useState(GraphNodeLimits.DEFAULT);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedRelationships, setSelectedRelationships] = useState<string[]>([]);
  const [customQuery, setCustomQuery] = useState('');
  const [showCustomQuery, setShowCustomQuery] = useState(false);
  const [allowWriteQueries, setAllowWriteQueries] = useState(false);

  // Node expansion state - tracks expanded nodes and what was added (for collapse)
  const [expandedNodes, setExpandedNodes] = useState<Map<number, { nodeIds: number[], edgeKeys: string[] }>>(new Map());
  // Document legend - maps chunk colors to document names with chunk counts
  const [documentLegend, setDocumentLegend] = useState<Array<{ color: string; borderColor: string; name: string; count: number }>>([]);
  // Tracks nodes that have been checked and have no unexpanded neighbors
  const [fullyExpandedNodes, setFullyExpandedNodes] = useState<Set<number>>(new Set());
  const [isExpandingNode, setIsExpandingNode] = useState(false);
  const [isCheckingExpandability, setIsCheckingExpandability] = useState(false);
  const isExpandingRef = useRef(false); // Ref to prevent main useEffect from overwriting during expansion
  const [nodeSpacing, setNodeSpacing] = useState(120); // Default springLength
  const nodeSpacingRef = useRef(120); // Ref for use in click handler (avoids stale closure)
  const [hideChunks, setHideChunks] = useState(false); // Toggle to hide chunk nodes
  const [graphSplitPercent, setGraphSplitPercent] = useState(60); // Graph takes this % when table is present
  const [graphCollapsed, setGraphCollapsed] = useState(false);
  const [tableCollapsed, setTableCollapsed] = useState(false);
  // Evidence mode: the checked-edge axis (UUID-space keys), local to the canvas. Mirrors the node
  // selection (graphEntityIds) but stays here because edges drive only the canvas.
  const [selectedEdgeKeys, setSelectedEdgeKeys] = useState<string[]>([]);
  // Collapse toggle for the right detail/selection pane (detail or multi-select summary).
  const [rightPaneCollapsed, setRightPaneCollapsed] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingSplit = useRef(false);
  const [isolatedNodeIds, setIsolatedNodeIds] = useState<number[]>([]); // Nodes to isolate (show only these + any expansion)
  const [isolatedEdge, setIsolatedEdge] = useState<{ from: number; to: number } | null>(null); // Edge to isolate (show only it + its nodes)
  const savedPositionsRef = useRef<Map<number, { x: number; y: number }>>(new Map()); // Save positions before isolating
  const [isGraphFrozen, setIsGraphFrozen] = useState(false); // Manual freeze toggle (click empty space to toggle)
  const isGraphFrozenRef = useRef(false); // Ref for use in click handler
  const nodeNeighbors = useNodeNeighbors();
  const nodeNeighborCount = useNodeNeighborCount();
  const findShortestPath = useFindShortestPath();
  const edgesBetween = useEdgesBetween();

  const visibleGraphNodes = useMemo(() => {
    let nodes = graphData.nodes;

    if (hideChunks) {
      nodes = nodes.filter(node =>
        !node.labels?.includes('Chunk') && !node.labels?.includes('Document')
      );
    }

    if (isolatedNodeIds.length > 0) {
      const visibleNodeIds = new Set<number>(isolatedNodeIds);
      expandedNodes.forEach((expansion) => {
        expansion.nodeIds.forEach(nodeId => visibleNodeIds.add(nodeId));
      });
      nodes = nodes.filter(node => visibleNodeIds.has(node.id));
    }

    if (isolatedEdge !== null) {
      const edgeNodeIds = new Set<number>([isolatedEdge.from, isolatedEdge.to]);
      nodes = nodes.filter(node => edgeNodeIds.has(node.id));
    }

    return nodes;
  }, [graphData.nodes, hideChunks, isolatedNodeIds, expandedNodes, isolatedEdge]);

  // Safe wrapper for vis-network setSelection — filters invalid IDs to prevent RangeError crashes
  const safeSetSelection = (selection: { nodes: number[], edges?: string[] }, opts?: any) => {
    if (!networkInstance.current) {return;}
    try {
      const net = networkInstance.current as any;
      const currentNodeIds = new Set(net.body.data.nodes.getIds());
      const validNodes = selection.nodes.filter(id => currentNodeIds.has(id));
      const currentEdgeIds = new Set(net.body.data.edges.getIds());
      const validEdges = (selection.edges || []).filter(id => currentEdgeIds.has(id));
      net.setSelection(
        { nodes: validNodes, edges: validEdges },
        opts
      );
    } catch {
      // Silently ignore if network is in an inconsistent state
    }
  };

  // Derived: single selected node (last selected) for Expand/Collapse/Isolate operations
  const selectedNode = selectedNodes.length === 1 && selectedEdges.length === 0 ? selectedNodes[0] : null;
  const selectedEdge = selectedNodes.length === 0 && selectedEdges.length === 1 ? selectedEdges[0] : null;
  const totalSelected = selectedNodes.length + selectedEdges.length;
  // Operation-set identifiers handed to the tables so op-selected rows render the canvas selection
  // highlight (and reflect canvas-side selections too). Node UUIDs live at properties.id; edge keys
  // go through the tested edgeToKey bridge (null when an endpoint is off-canvas — dropped here).
  const opSelectedEntityIds = selectedNodes
    .map(n => n.properties?.id)
    .filter((id): id is string => typeof id === 'string');
  const opSelectedNodesByNeoId = new Map<number, GraphNode>(graphData.nodes.map(n => [n.id, n]));
  const opSelectedEdgeKeys = selectedEdges
    .map(e => edgeToKey(e, opSelectedNodesByNeoId))
    .filter((k): k is string => k !== null);
  // The right detail pane shows, in priority order: the hovered element (transient peek), else the
  // pinned/last-clicked element (persistent — stays through multi-select), else the single selected
  // element (fallback for selections made without a canvas click, e.g. the table's Select all).
  const singleSelectionTarget: InspectTarget | null = selectedNode
    ? { kind: 'node', data: selectedNode }
    : selectedEdge
      ? { kind: 'edge', data: selectedEdge }
      : null;
  const paneTarget: InspectTarget | null = hoveredElement ?? pinnedElement ?? singleSelectionTarget;

  // Is the element currently in the pane the pinned one? Drives the card's 📌 toggle state.
  const sameInspectTarget = useCallback((a: InspectTarget, b: InspectTarget): boolean => {
    if (a.kind === 'node' && b.kind === 'node') {return a.data.id === b.data.id;}
    if (a.kind === 'edge' && b.kind === 'edge') {return getEdgeKey(a.data) === getEdgeKey(b.data);}
    return false;
  }, []);
  const paneTargetIsPinned = !!pinnedElement && !!paneTarget && sameInspectTarget(pinnedElement, paneTarget);
  // 📌 button on the card: pin the element shown, or unpin if it's already the pinned one. Decoupled
  // from selection — works identically for nodes and edges (no canvas gesture).
  const handleTogglePin = () => {
    if (!paneTarget) {return;}
    setPinnedElement(paneTargetIsPinned ? null : paneTarget);
  };

  // Is the pane's element in the operation-set (selection)? Reflects membership from ANY source —
  // table checkboxes, Select all, or this card's own toggle — so the card's "Selected" button shows
  // toggled-on whenever the element is selected, however that happened.
  const paneTargetIsSelected = !!paneTarget && (
    paneTarget.kind === 'node'
      ? selectedNodes.some(n => n.id === paneTarget.data.id)
      : selectedEdges.some(e => getEdgeKey(e) === getEdgeKey(paneTarget.data))
  );
  // "Selected" button on the card: add the pane's element to the selection, or remove it if already
  // selected. Mirrors the table-driven select toggles (no physics management) — with canvas left-click
  // now pinning, this card control and the tables are the only ways into the selection set.
  const handleToggleSelected = () => {
    if (!paneTarget) {return;}
    if (paneTarget.kind === 'node') {
      const node = paneTarget.data;
      setSelectedNodes(prev => {
        const isSel = prev.some(n => n.id === node.id);
        const next = isSel ? prev.filter(n => n.id !== node.id) : [...prev, node];
        safeSetSelection(
          { nodes: next.map(n => n.id), edges: [...selectedEdgeIdsRef.current] },
          { highlightEdges: false },
        );
        return next;
      });
    } else {
      const edge = paneTarget.data;
      const edgeKey = getEdgeKey(edge);
      setSelectedEdges(prev => {
        const isSel = prev.some(e => getEdgeKey(e) === edgeKey);
        const next = isSel ? prev.filter(e => getEdgeKey(e) !== edgeKey) : [...prev, edge];
        safeSetSelection(
          { nodes: [...selectedNodeIdsRef.current], edges: next.map(e => getEdgeKey(e)) },
          { highlightEdges: false },
        );
        return next;
      });
    }
  };

  // Mirror the pinned element into refs the beforeDrawing renderer reads, and repaint so its gray
  // halo updates immediately.
  useEffect(() => {
    pinnedNodeIdRef.current = pinnedElement?.kind === 'node' ? pinnedElement.data.id : null;
    pinnedEdgeKeyRef.current = pinnedElement?.kind === 'edge' ? getEdgeKey(pinnedElement.data) : null;
    networkInstance.current?.redraw();
  }, [pinnedElement]);

  // Drop the pinned card if its element is no longer on the canvas (removed, reset, unchecked) —
  // one guard that covers every removal path so the pane never references a gone element.
  useEffect(() => {
    if (!pinnedElement) {return;}
    const present = pinnedElement.kind === 'node'
      ? graphData.nodes.some(n => n.id === pinnedElement.data.id)
      : graphData.edges.some(e => getEdgeKey(e) === getEdgeKey(pinnedElement.data));
    if (!present) {setPinnedElement(null);}
  }, [graphData, pinnedElement]);

  // Resolve a UUID-space citation target ({nodeUuid} | {edge}) to the rendered node/edge on THIS
  // canvas, so a citation can drive the same inspect/pin state a canvas gesture would. A target that
  // was demoted off the canvas resolves to null → the citation does nothing (no crash).
  const findCitationInspectTarget = useCallback((
    target: { nodeUuid?: string; edge?: { src: string; relType: string; tgt: string } } | null,
  ): InspectTarget | null => {
    if (!target) {return null;}
    if (target.edge) {
      const { src, relType, tgt } = target.edge;
      const srcNode = graphData.nodes.find(n => n.properties?.id === src);
      const tgtNode = graphData.nodes.find(n => n.properties?.id === tgt);
      if (!srcNode || !tgtNode) {return null;}
      const edge = graphData.edges.find(e => {
        const endpointsMatch =
          (e.from === srcNode.id && e.to === tgtNode.id) || (e.from === tgtNode.id && e.to === srcNode.id);
        return endpointsMatch && relationshipTypeMatches(relType, e);
      });
      return edge ? { kind: 'edge', data: edge } : null;
    }
    if (target.nodeUuid) {
      const node = graphData.nodes.find(n => n.properties?.id === target.nodeUuid);
      return node ? { kind: 'node', data: node } : null;
    }
    return null;
  }, [graphData]);

  // Resolve a citation request against the current canvas and toggle its pin (same pinnedElement → gray
  // halo + 📌 card; re-pin unpins, pin a different one moves it). Returns whether it resolved — false
  // means the cited element isn't on the canvas yet.
  const tryPinCitation = useCallback((req: CitationPinRequest): boolean => {
    const resolved = findCitationInspectTarget(req.target);
    if (!resolved) {return false;}
    setPinnedElement(prev => (prev && sameInspectTarget(prev, resolved) ? null : resolved));
    return true;
  }, [findCitationInspectTarget, sameInspectTarget]);

  // A relationship citation whose endpoints are on the canvas but whose edge was deselected (the user
  // removed it this turn) → re-select the edge's UUID-space key so it renders and the pin can land.
  // Keyed off the FULL evidence graph (`enumerationData.graphData`); the rendered `graphData` no longer
  // holds the edge. The key is computed via `edgeToKey` (the edge's own from→to direction) so it matches
  // the `selectedEdgeKeys` space exactly regardless of the cited triple's order.
  const reAddCitedEdge = useCallback((target: CitationPinRequest['target']): void => {
    const edge = target.edge;
    const base = enumerationData?.graphData;
    if (!edge || !base) {return;}
    const byNeoId = new Map<number, { id: number; properties?: { id?: string } }>();
    for (const n of base.nodes) {
      byNeoId.set(n.id, { id: n.id, properties: { id: n.properties?.id } });
    }
    const srcNode = base.nodes.find(n => n.properties?.id === edge.src);
    const tgtNode = base.nodes.find(n => n.properties?.id === edge.tgt);
    if (!srcNode || !tgtNode) {return;}
    const baseEdge = base.edges.find(e => {
      const endpointsMatch =
        (e.from === srcNode.id && e.to === tgtNode.id) || (e.from === tgtNode.id && e.to === srcNode.id);
      return endpointsMatch && relationshipTypeMatches(edge.relType, e);
    });
    if (!baseEdge) {return;}
    const key = edgeToKey(baseEdge, byNeoId);
    if (!key) {return;}
    setSelectedEdgeKeys(prev => (prev.includes(key) ? prev : [...prev, key]));
  }, [enumerationData?.graphData]);

  // Citation PIN: clicking an inline citation toggles the pin on the cited node/edge exactly like
  // left-clicking it on the canvas. If the cited element isn't on the canvas yet, hold the request as
  // PENDING — ChatInterface jumps to the citation's turn (or re-adds the removed node), updating
  // graphData; a same-turn removed edge is re-selected here. The retry effect below lands the pin once
  // the target appears; the fallback timer reports a genuinely off-graph citation. Guards on the request
  // object's identity so it fires once per click, not when graphData re-renders.
  useEffect(() => {
    if (!isInChatContext || !graphCitationPin) {return;}
    if (graphCitationPin === lastCitationPinRef.current) {return;}
    lastCitationPinRef.current = graphCitationPin;

    if (tryPinCitation(graphCitationPin)) {return;}

    // Not on the canvas yet — re-select a removed same-turn edge, then wait for the graph to settle.
    reAddCitedEdge(graphCitationPin.target);
    pendingCitationPinRef.current = graphCitationPin;
    if (citationPinFallbackTimerRef.current) {clearTimeout(citationPinFallbackTimerRef.current);}
    citationPinFallbackTimerRef.current = setTimeout(() => {
      const stillPending = pendingCitationPinRef.current;
      if (!stillPending) {return;}
      pendingCitationPinRef.current = null;
      // Still unresolved after the jump / re-add had time to land → the citation truly has no element on
      // any graph (stale/garbled handle or a whole-retrieval [[Q#]] that filtered out).
      notifications.show({
        message: stillPending.target.edge
          ? 'That relationship isn’t on the current graph.'
          : 'That entity isn’t on the current graph.',
        color: 'gray',
        autoClose: 2500,
      });
    }, 1500);
  }, [graphCitationPin, isInChatContext, tryPinCitation, reAddCitedEdge]);

  // Land a pending citation pin once its target appears on the canvas (after the jump / node re-add
  // settles graphData). Until then, keep nudging a removed same-turn edge back into the selection.
  useEffect(() => {
    const pending = pendingCitationPinRef.current;
    if (!pending) {return;}
    if (tryPinCitation(pending)) {
      pendingCitationPinRef.current = null;
      if (citationPinFallbackTimerRef.current) {
        clearTimeout(citationPinFallbackTimerRef.current);
        citationPinFallbackTimerRef.current = null;
      }
    } else {
      reAddCitedEdge(pending.target);
    }
  }, [graphData, tryPinCitation, reAddCitedEdge]);

  // Clear the fallback timer on unmount so a pending pin can't fire its notice after the canvas is gone.
  useEffect(() => () => {
    if (citationPinFallbackTimerRef.current) {clearTimeout(citationPinFallbackTimerRef.current);}
  }, []);

  // Reset the canvas to the post-answer state: clear expansions/isolation/op-set, restore the
  // evidence edge selection, and ask the owner to restore the node selection (the cited subset).
  // Shared by the bottom-left Reset control and the empty-state Reset, so Reset stays reachable even
  // after the user removes every node from the graph.
  const handleResetGraph = () => {
    removedNodeIdsRef.current.clear();
    if (originalGraphDataRef.current.nodes.length > 0) {
      setGraphData(originalGraphDataRef.current);
    }
    setExpandedNodes(new Map());
    setConnectedPaths(new Map());
    setFullyExpandedNodes(new Set());
    setIsolatedNodeIds([]);
    setIsolatedEdge(null);
    setSelectedNodes([]);
    setSelectedEdges([]);
    if (evidenceMode && enumerationData?.graphData) {
      setSelectedEdgeKeys(allEdgeKeys(enumerationData.graphData));
    }
    onResetGraph?.();
  };

  // The Reset control, positioned bottom-left. Rendered identically in the populated graph AND the
  // empty-state overlay so it never moves — the empty overlay fills the canvas (inset:0), so the same
  // absolute offset lands in the same spot.
  const resetGraphControl = (
    <Group
      spacing={6}
      sx={{
        position: 'absolute',
        bottom: 40,
        left: 8,
        cursor: 'pointer',
        opacity: 0.7,
        zIndex: 5,
        '&:hover': { opacity: 1 },
      }}
      onClick={handleResetGraph}
    >
      <IconRefresh size={14} color='white' />
      <Text size='xs' color='gray.4'>Reset Graph</Text>
    </Group>
  );

  // (enumeration transitions handled by isInteractive merge in data useEffect)

  // Keep refs in sync with state to avoid stale closure in click handler
  useEffect(() => {
    graphDataRef.current = graphData;
  }, [graphData]);

  useEffect(() => {
    selectedNodeIdsRef.current = new Set(selectedNodes.map(n => n.id));
  }, [selectedNodes]);

  // Feed the entity IDs visible on the canvas upward for the per-question graph snapshot.
  useEffect(() => {
    if (onGraphDisplayedNodesChange) {
      const entityIds = visibleGraphNodes
        .map(n => n.properties?.id)
        .filter((id): id is string => typeof id === 'string');
      onGraphDisplayedNodesChange(entityIds);
    }
  }, [visibleGraphNodes, onGraphDisplayedNodesChange]);

  useEffect(() => () => {
    onGraphDisplayedNodesChange?.([]);
  }, [onGraphDisplayedNodesChange]);

  // Drop canvas-selected nodes/edges when their row is unchecked in the table.
  // The downstream prune at line ~2003 is gated on graphData.nodes.length > 0,
  // so an uncheck-all → re-check-all cycle would otherwise leave selection sticky.
  const prevTableSelectedEntityIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const prev = new Set(prevTableSelectedEntityIdsRef.current);
    const curr = new Set(selectedEntityIds ?? []);
    prevTableSelectedEntityIdsRef.current = selectedEntityIds ?? [];

    const removedEntityIds = new Set([...prev].filter(id => !curr.has(id)));
    if (removedEntityIds.size === 0) {return;}

    const removedNeoIds = new Set<number>(
      selectedNodes
        .filter(n => n.properties?.id && removedEntityIds.has(n.properties.id))
        .map(n => n.id),
    );
    if (removedNeoIds.size === 0) {return;}

    setSelectedNodes(p => p.filter(n => !removedNeoIds.has(n.id)));
    setSelectedEdges(p => p.filter(e => !removedNeoIds.has(e.from) && !removedNeoIds.has(e.to)));
  }, [selectedEntityIds, selectedNodes]);

  useEffect(() => {
    selectedEdgeIdsRef.current = new Set(selectedEdges.map(e => getEdgeKey(e)));
  }, [selectedEdges]);

  // Evidence default-on: check every cited edge when a NEW evidence subgraph arrives, so the canvas
  // renders the full subgraph. Keyed on the edge-key content (mirrors the node auto-select in
  // ChatInterface) so the user can deselect afterward without it snapping back. Reset off-evidence
  // so re-entry re-defaults.
  const prevEvidenceEdgeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!evidenceMode || !enumerationData?.graphData) {
      prevEvidenceEdgeKeyRef.current = null;
      return;
    }
    const keys = allEdgeKeys(enumerationData.graphData);
    const k = keys.join(',');
    if (prevEvidenceEdgeKeyRef.current === k) {return;}
    prevEvidenceEdgeKeyRef.current = k;
    setSelectedEdgeKeys(keys);
  }, [evidenceMode, enumerationData?.graphData]);

  // Drag handler for resizing graph/table split
  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplit.current = true;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSplit.current || !splitContainerRef.current) {return;}
      const rect = splitContainerRef.current.getBoundingClientRect();
      const percent = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setGraphSplitPercent(Math.min(85, Math.max(15, percent)));
    };

    const onMouseUp = () => {
      isDraggingSplit.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Ref for isInChatContext to avoid stale closure in click handler
  const isInChatContextRef = useRef(isInChatContext);
  useEffect(() => {
    isInChatContextRef.current = isInChatContext;
  }, [isInChatContext]);

  // Keep isGraphFrozenRef in sync
  useEffect(() => {
    isGraphFrozenRef.current = isGraphFrozen;
  }, [isGraphFrozen]);

  // Keep refs in sync
  useEffect(() => {
    nodeSpacingRef.current = nodeSpacing;
  }, [nodeSpacing]);

  // Check if selected node has expandable neighbors (pre-check for button state)
  // Uses fast COUNT query instead of fetching all neighbors
  useEffect(() => {
    if (!selectedNode || !isInChatContext || !documentIds || documentIds.length === 0) {
      return;
    }
    // Skip if already known to be fully expanded or already expanded
    if (fullyExpandedNodes.has(selectedNode.id) || expandedNodes.has(selectedNode.id)) {
      return;
    }

    let isCancelled = false;

    const checkExpandability = async () => {
      setIsCheckingExpandability(true);

      try {
        // Fast COUNT query to get total neighbor count
        const countResult = await nodeNeighborCount.fetch({
          documentIds,
          nodeNeoId: selectedNode.id,
        });

        // Don't update state if cancelled (node changed)
        if (isCancelled) {
          return;
        }

        // Count how many of this node's neighbors are already visible
        // Build a set of all node IDs that are connected to selectedNode in the current graph
        const visibleNeighborIds = new Set<number>();
        for (const edge of graphData.edges) {
          if (edge.from === selectedNode.id) {
            visibleNeighborIds.add(edge.to);
          }
          if (edge.to === selectedNode.id) {
            visibleNeighborIds.add(edge.from);
          }
        }

        // If all neighbors are already visible, mark as fully expanded
        if (visibleNeighborIds.size >= countResult.totalNeighbors) {
          setFullyExpandedNodes(prev => new Set([...prev, selectedNode.id]));
        }
      } catch (error) {
        // On error, leave button enabled (user can try manually)
        console.error('[EXPANDABILITY-CHECK] Error:', error);
      } finally {
        if (!isCancelled) {
          setIsCheckingExpandability(false);
        }
      }
    };

    checkExpandability();

    return () => {
      isCancelled = true;
      setIsCheckingExpandability(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id, isInChatContext, documentIds, graphData.edges]);

  // Settings context: Check if selected node has expandable neighbors (pre-check for button state)
  // Uses fast COUNT query instead of fetching all neighbors
  useEffect(() => {
    if (!selectedNode || isInChatContext) {
      return;
    }
    // Skip if already known to be fully expanded or already expanded
    if (fullyExpandedNodes.has(selectedNode.id) || expandedNodes.has(selectedNode.id)) {
      return;
    }

    let isCancelled = false;

    const checkExpandability = async () => {
      setIsCheckingExpandability(true);

      try {
        // Fast COUNT query to get total neighbor count
        const cypherQuery = `
          MATCH (n)-[r]-(m)
          WHERE id(n) = ${selectedNode.id}
          RETURN count(DISTINCT m) as totalNeighbors
        `;
        const result = await expandQuery.mutateAsync({ query: cypherQuery });

        // Don't update state if cancelled (node changed)
        if (isCancelled) {
          return;
        }

        // Extract count from result
        let totalNeighbors = 0;
        if (result.results.length > 0) {
          const countValue = result.results[0].totalNeighbors;
          totalNeighbors = typeof countValue === 'object' && countValue.toNumber
            ? countValue.toNumber()
            : parseInt(countValue?.toString() || '0', 10);
        }

        // Count how many of this node's neighbors are already visible
        const visibleNeighborIds = new Set<number>();
        for (const edge of graphData.edges) {
          if (edge.from === selectedNode.id) {
            visibleNeighborIds.add(edge.to);
          }
          if (edge.to === selectedNode.id) {
            visibleNeighborIds.add(edge.from);
          }
        }

        // If all neighbors are already visible, mark as fully expanded
        if (visibleNeighborIds.size >= totalNeighbors) {
          setFullyExpandedNodes(prev => new Set([...prev, selectedNode.id]));
        }
      } catch (error) {
        // On error, leave button enabled (user can try manually)
        console.error('[EXPANDABILITY-CHECK] Error:', error);
      } finally {
        if (!isCancelled) {
          setIsCheckingExpandability(false);
        }
      }
    };

    checkExpandability();

    return () => {
      isCancelled = true;
      setIsCheckingExpandability(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id, isInChatContext]);

  // Keep vis-network canvas pixel dimensions in sync with container size.
  // autoResize is off (it triggers an auto-fit that resets the user's zoom/pan),
  // so without this observer the canvas keeps its original dimensions while CSS
  // stretches it — making circles render as horizontally/vertically elongated ovals.
  useEffect(() => {
    const el = networkRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!networkInstance.current) {
        return;
      }
      const width = el.clientWidth;
      const height = el.clientHeight;
      // Skip when hidden (display:none) or not yet laid out — setSize(0,0) wipes the canvas
      // and vis-network doesn't recover when the container becomes visible again.
      if (width === 0 || height === 0) {
        return;
      }
      const scale = networkInstance.current.getScale();
      const position = networkInstance.current.getViewPosition();
      networkInstance.current.setSize(`${width}px`, `${height}px`);
      networkInstance.current.moveTo({ position, scale, animation: false });
      networkInstance.current.redraw();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { data: overviewData } = useGetOverview();
  
  // Full network query (when no anchors provided)
  // Limit to 300 nodes to prevent browser slowdown on large documents
  const FULL_GRAPH_NODE_LIMIT = 300;
  const chatNetworkQuery = useChatNetwork({
    documentIds: documentIds || [],
    limit: FULL_GRAPH_NODE_LIMIT,
    labels: selectedLabels,
    relationships: selectedRelationships,
  }, {
    enabled: isInChatContext && !enumerationData && (documentIds && documentIds.length > 0),
  });

  const graphQuery = useQuery();
  // Separate mutation hook for expansion queries (settings context only)
  // This prevents expand queries from overwriting graphQuery.data which would
  // cause the formatting useEffect to overwrite the full graph with just neighbors
  const expandQuery = useQuery();

  // Use the appropriate query based on context
  const _networkQuery = isInChatContext ? chatNetworkQuery : graphQuery;

  // Type assertion needed because vis-network types don't fully reflect that chosen.edge/node can be functions
  const networkOptions: any = {
    autoResize: false, // Prevent auto-fit when container resizes (e.g., when details panel opens)
    nodes: {
      shape: 'dot',
      size: 20,
      font: { 
        size: 12, 
        color: '#ffffff',
        strokeWidth: 2,
        strokeColor: '#000000',
        background: 'rgba(0, 0, 0, 0.8)',
        align: 'center',
        vadjust: 0,
      },
      borderWidth: 2,
      chosen: {
        node: function(values: Record<string, any>, id: string | number, selected: boolean, hovering: boolean) {
          // Suppress the red highlight while a drag is in progress on a node that
          // wasn't already selected — drag is pure motion, not a selection action.
          const drag = isDraggingNodeRef.current;
          const draggingUnselected = !!drag && drag.nodeId === id && !drag.wasSelected;
          const showSelected = selected && !draggingUnselected;
          if (showSelected) {
            // Selected = crisp red RING; keep the type fill (values.color) so the node's
            // type/document color stays readable (selection is usually by type).
            values.borderColor = '#FF4444';
            values.borderWidth = 4;
          }
          if (hovering) {
            // Hover = soft additive blue halo (Neo4j-Browser style) — keeps the type color.
            values.size = (values.size || 20) + 3;
            values.shadow = true;
            values.shadowColor = 'rgba(70, 130, 255, 0.85)';
            values.shadowSize = 18;
            values.shadowX = 0;
            values.shadowY = 0;
          }
          if (hovering || showSelected) {
            values.font = {
              ...values.font,
              size: 13,
              background: 'rgba(0, 0, 0, 0.9)',
            };
          }
        },
        label: function(_values: Record<string, any>, _id: string | number, _selected: boolean, _hovering: boolean) {
          // Optional label styling on selection/hover
        },
      },
    },
    edges: {
      width: 1.5,
      font: { size: 10, align: 'middle', color: '#999999', strokeWidth: 0 },
      arrows: { to: { enabled: true, scaleFactor: 0.5 } },
      // Slight curvature so parallel edges between the same node pair fan out
      // visually instead of stacking on top of each other (which would also stack
      // their labels into garbled text).
      smooth: { enabled: true, type: 'continuous', roundness: 0.15 } as any,
      chosen: {
        edge: function(values: Record<string, any>, id: string | number, selected: boolean, hovering: boolean) {
          if (selected) {
            values.color = '#FF4444'; // Selected edges stay solid red (no fill to preserve)
            values.width = 3;
          } else if (hovering) {
            // Hover = soft blue glow + thicker line (edges have no fill, so the glow is the cue).
            values.width = 3;
            values.shadow = true;
            values.shadowColor = 'rgba(70, 130, 255, 0.85)';
            values.shadowSize = 14;
            values.shadowX = 0;
            values.shadowY = 0;
          }
        },
      },
    },
    physics: {
      enabled: true,
      stabilization: {
        enabled: true,
        iterations: 150,
        updateInterval: 50,
        onlyDynamicEdges: false,
        fit: false,
      },
      barnesHut: {
        gravitationalConstant: -1400,
        centralGravity: 0.5,
        springLength: 120,
        springConstant: 0.04,
        damping: 0.09,
        avoidOverlap: 0.5,
      },
      maxVelocity: 50,
      minVelocity: 0.1,
      timestep: 0.3,
    },
    interaction: {
      hover: true,
      hoverConnectedEdges: false, // Don't highlight connected edges on node hover
      tooltipDelay: 200,
      dragNodes: true,
      dragView: true,
      zoomView: true,
      selectConnectedEdges: false, // Don't auto-select edges when selecting nodes
    },
    layout: {
      improvedLayout: true,
      clusterThreshold: 150,
    },
  };

  // Standard node colors by type (used across all graph contexts)
  // Only Entity and Concept exist as node labels - Documents and Chunks are handled specially
  const nodeColors = {
    Entity: '#96CEB4',   // Sage green
    Concept: '#45B7D1',  // Cyan
    Default: '#DDA0DD',  // Plum (fallback)
  };

  // Color palette for chunks from different documents (more saturated colors)
  // Yellow/green/cyan-ish colors moved to end to avoid confusion with Entity (#96CEB4) and Concept (#45B7D1)
  const chunkColorPalette = [
    '#CC7EB8', // Orchid (more saturated plum)
    '#E57373', // Coral red
    '#9575CD', // Purple
    '#FF8C42', // Orange
    '#64B5F6', // Light Blue (distinct from purple)
    '#4DB6AC', // Teal (slightly cyan-ish)
    '#FFD54F', // Amber (yellow-ish)
    '#81C784', // Green (distinct from Entity #96CEB4)
    '#A1887F', // Brown/Tan (distinct warm neutral)
    '#4DD0E1', // Cyan (similar to Concept)
  ];

  // Simple hash function to get consistent color index from document ID
  // Ensures same document always gets same color across chat and settings views
  const getColorIndexFromDocId = (docId: string): number => {
    let hash = 0;
    for (let i = 0; i < docId.length; i++) {
      const char = docId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % chunkColorPalette.length;
  };

  // Ref to store documentColorMap for use in expand handler
  const documentColorMapRef = useRef<Map<string, string>>(new Map());
  // Ref to store documentId → name mapping for detail panels
  const documentNameMapRef = useRef<Map<string, string>>(new Map());

  // Resolve the document chip (name + colors) for a documentId, mirroring the inline
  // resolution the detail panels use, so the inspect popover can show the same chrome.
  const resolveDocumentInfo = (docId?: string): GraphElementDocumentInfo | null => {
    if (!docId) {return null;}
    const color = documentColorMapRef.current?.get(docId) || '#666';
    const name = documentNameMap[docId]
      || documentNameMapRef.current?.get(docId)
      || documentLegend.find(l => l.color === color)?.name;
    if (!name) {return null;}
    const borderColor = documentLegend.find(l => l.color === color)?.borderColor || color;
    return { name, color, borderColor };
  };

  // Document chip for whatever element the right pane is showing (node uses its documentId;
  // edge falls back to either endpoint's documentId — same logic as the edge detail panel).
  const paneDocumentInfo: GraphElementDocumentInfo | null = (() => {
    if (!paneTarget) {return null;}
    if (paneTarget.kind === 'node') {
      return resolveDocumentInfo(paneTarget.data.properties?.documentId);
    }
    const edge = paneTarget.data;
    const edgeDocId = edge.properties?.documentId
      || graphData.nodes.find(n => n.id === edge.from)?.properties?.documentId
      || graphData.nodes.find(n => n.id === edge.to)?.properties?.documentId;
    return resolveDocumentInfo(edgeDocId);
  })();

  // View-Source action for a Chunk node shown in the pane — same payload shape as before.
  const handleViewSource = (target: InspectTarget) => {
    if (target.kind !== 'node') {return;}
    const props = target.data.properties;
    if (!props?.documentId) {return;}
    setSourcesSidebarExpanded(true);
    setTimeout(() => {
      setHighlightedCitation({
        documentId: props.documentId,
        embeddingId: props.embeddingId || props.id,
        citation: props.content || props.summary || '',
        startPosition: props.startPosition ?? undefined,
        endPosition: props.endPosition ?? undefined,
      });
    }, 50);
  };

  // Helper to darken a hex color for node borders
  const darkenColor = (hex: string, percent: number = 20): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(2.55 * percent));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(2.55 * percent));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  };

  // Handle node spacing slider change - update physics dynamically
  const handleNodeSpacingChange = (value: number) => {
    setNodeSpacing(value);
    if (networkInstance.current) {
      // Scale repulsion more aggressively for dense graphs
      // At 120 (default): -1400, at 500: -8000+
      const baseRepulsion = -1400;
      const repulsionScale = (value - 120) * 15;
      const gravitationalConstant = baseRepulsion - repulsionScale;

      networkInstance.current.setOptions({
        physics: {
          enabled: true,
          barnesHut: {
            springLength: value,
            gravitationalConstant,
            avoidOverlap: Math.min(1, 0.5 + (value - 120) / 400), // Increase overlap avoidance
          },
        },
      });
      // Slider re-enables physics for live re-layout, so the canvas is no
      // longer frozen — without this, the next empty-space click would flip
      // the toggle in the wrong direction (un-freeze rather than freeze).
      if (isGraphFrozenRef.current) {
        setIsGraphFrozen(false);
      }
    }
  };

  // Shared node formatting function - single source of truth for all node styling
  const formatNode = (
    node: GraphNode,
    documentColorMap: Map<string, string>,
  ) => {
    // Check labels directly (not group, which only uses the first label)
    const isDocument = node.labels?.includes('Document');
    const isChunk = node.labels?.includes('Chunk');
    const isEntity = node.labels?.includes('Entity');
    const isConcept = node.labels?.includes('Concept');

    // Extract display label based on node type
    let displayLabel = '';
    if (isDocument || isChunk) {
      // No label for document or chunk nodes
      displayLabel = '';
    } else if (node.properties?.name) {
      displayLabel = node.properties.name;
    } else if (node.properties?.title) {
      displayLabel = node.properties.title;
    } else if (node.properties?.filename) {
      displayLabel = node.properties.filename.split('/').pop()?.split('.').shift() || node.properties.filename;
    } else if (node.properties?.source) {
      displayLabel = node.properties.source;
    } else {
      displayLabel = node.labels?.[0] || `Node ${node.id}`;
    }

    // Truncate long labels
    if (displayLabel.length > 25) {
      displayLabel = displayLabel.substring(0, 22) + '...';
    }

    // Determine node color based on labels (check labels directly, not group)
    let nodeColor: string;
    if (isDocument) {
      const docId = node.properties?.id;
      nodeColor = docId ? (documentColorMap.get(docId) || '#DDA0DD') : '#DDA0DD';
    } else if (isChunk) {
      const chunkDocId = node.properties?.documentId;
      nodeColor = chunkDocId ? (documentColorMap.get(chunkDocId) || '#DDA0DD') : '#DDA0DD';
    } else if (isEntity) {
      nodeColor = nodeColors.Entity;
    } else if (isConcept) {
      nodeColor = nodeColors.Concept;
    } else {
      nodeColor = nodeColors.Default;
    }

    const borderColor = darkenColor(nodeColor, 25);

    // Base node object without group (vis-network uses group for auto-coloring which we don't want)
    const { group: _group, ...nodeWithoutGroup } = node;

    // Build base style per node type
    let baseStyle: Record<string, any>;
    if (isDocument) {
      baseStyle = {
        color: { background: '#FFFFFF', border: borderColor },
        shape: 'box',
        widthConstraint: { minimum: 20, maximum: 20 },
        heightConstraint: { minimum: 30 },
        borderWidth: 2,
        shapeProperties: { borderRadius: 0 },
        title: `📄 DOCUMENT\n${node.labels.join(', ')}\n${JSON.stringify(node.properties, null, 2)}`,
      };
    } else if (isChunk) {
      baseStyle = {
        color: { background: nodeColor, border: borderColor },
        shape: 'square',
        size: 8,
        borderWidth: 2,
        title: `${node.labels.join(', ')}\n${JSON.stringify(node.properties, null, 2)}`,
      };
    } else {
      // Entity, Concept, and all other node types
      // Scale size by mentionCount: small (1-3), medium (4-15), large (16-50), supernode (51+)
      const mentionCount = node.properties?.mentionCount ?? 1;
      let nodeSize: number;
      if (mentionCount > 50) {nodeSize = 40;}
      else if (mentionCount > 15) {nodeSize = 30;}
      else if (mentionCount > 3) {nodeSize = 20;}
      else {nodeSize = 12;}

      baseStyle = {
        color: { background: nodeColor, border: borderColor },
        shape: 'dot',
        size: nodeSize,
        borderWidth: 2,
        title: `${node.labels.join(', ')}\n${JSON.stringify(node.properties, null, 2)}`,
      };
    }

    // Apply highlight/hover colors to match border
    const finalBorder = baseStyle.color.border;
    baseStyle.color.highlight = { background: baseStyle.color.background, border: finalBorder };
    baseStyle.color.hover = { background: baseStyle.color.background, border: finalBorder };

    return {
      ...nodeWithoutGroup,
      label: displayLabel,
      ...baseStyle,
    };
  };

  // Vibrant springy physics - lively bouncy movement
  // minVelocity: 0 prevents auto-stabilization so it keeps moving
  // centralGravity: 0.3 keeps disconnected nodes clustered instead of flying apart
  const subtlePhysics = {
    enabled: true,
    stabilization: { enabled: false },
    barnesHut: {
      gravitationalConstant: -300,
      centralGravity: 0.3,
      springLength: 120,
      springConstant: 0.02,
      damping: 0.15,
      avoidOverlap: 0.3,
    },
    maxVelocity: 30,
    minVelocity: 0,
    timestep: 0.5,
  };

  // Fit the graph view, shifting upward when the table is present so nodes
  // aren't hidden behind it. Moves the center point down by 1/3 of the canvas
  // height so nodes land in the upper portion of the visible graph area.
  const fitGraph = () => {
    if (!networkInstance.current) {return;}
    if (enumerationData) {
      // Zoom out a bit and shift up so nodes sit in upper portion above the table
      networkInstance.current.fit({ animation: false });
      const pos = networkInstance.current.getViewPosition();
      const scale = networkInstance.current.getScale() * 0.75;
      const canvas = networkRef.current;
      const canvasHeight = canvas?.clientHeight || 600;
      networkInstance.current.moveTo({
        position: { x: pos.x, y: pos.y + canvasHeight / 5 / scale },
        scale,
        animation: false,
      });
    } else {
      networkInstance.current.fit();
    }
  };

  // Helper to get subtle physics with current node spacing (uses refs to avoid stale closure)
  const getSubtlePhysicsWithSpacing = () => {
    const spacing = nodeSpacingRef.current;
    const baseRepulsion = -300;
    const repulsionScale = (spacing - 120) * 5;
    const gravitationalConstant = baseRepulsion - repulsionScale;
    return {
      ...subtlePhysics,
      barnesHut: {
        ...subtlePhysics.barnesHut,
        springLength: spacing,
        gravitationalConstant,
        avoidOverlap: Math.min(1, 0.3 + (spacing - 120) / 400),
      },
    };
  };

  // Full physics for initial layout and expansion
  const fullPhysics = {
    enabled: true,
    barnesHut: {
      gravitationalConstant: -1400,
      centralGravity: 0.5,
      springLength: 120,
      springConstant: 0.04,
      damping: 0.09,
      avoidOverlap: 0.5,
    },
    maxVelocity: 50,
    minVelocity: 0.1,
    timestep: 0.3,
  };

  const overview = overviewData?.overview;

  const loadNetwork = () => {
    setHasLoadedNetwork(true);
    if (isInChatContext) {
      chatNetworkQuery.refetch();
    } else {
      // Filter out '__ALL__' - it means no filter (send empty array)
      const labelsToSend = selectedLabels.includes('__ALL__') ? [] : selectedLabels;
      const relationshipsToSend = selectedRelationships.includes('__ALL__') ? [] : selectedRelationships;
      graphQuery.mutate({
        limit,
        labels: labelsToSend,
        relationships: relationshipsToSend,
      });
    }
  };

  // Auto-load when in chat context
  useEffect(() => {
    if (isInChatContext && documentIds && documentIds.length > 0) {
      setHasLoadedNetwork(true);
    }
  }, [isInChatContext, documentIds]);

  const runCustomQuery = async () => {
    try {
      const result = await graphQuery.mutateAsync({ query: customQuery, allowWrite: allowWriteQueries });
      setCustomQueryResult(result);
      notifications.show({
        message: `Returned ${result.recordCount} records`,
        color: 'teal',
        autoClose: 2000,
        withCloseButton: false,
      });
    } catch (error: unknown) {
      notifications.show({
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        color: 'red',
        autoClose: 3000,
        withCloseButton: false,
      });
    }
  };

  const executeCustomQuery = () => {
    if (!customQuery.trim()) {
      notifications.show({
        message: 'Please enter a Cypher query',
        color: 'red',
        autoClose: 2000,
        withCloseButton: false,
      });
      return;
    }

    if (allowWriteQueries) {
      modals.openConfirmModal({
        title: 'Confirm write query execution',
        centered: true,
        children: (
          <Text color='gray.7' fz='sm' mb='md'>
            Write queries can modify or delete data in your graph database. Are you sure you want to execute this query?
          </Text>
        ),
        labels: {
          confirm: 'Execute',
          cancel: 'Cancel',
        },
        cancelProps: { variant: 'outline' },
        confirmProps: {},
        groupProps: { spacing: 'lg', grow: true },
        withCloseButton: false,
        onConfirm: runCustomQuery,
      });
      return;
    }

    runCustomQuery();
  };

  // Handle network data when it changes
  useEffect(() => {
    // Skip if we're in the middle of an expansion (settings context)
    // The expansion handler manages graphData directly
    if (isExpandingRef.current) {
      return;
    }

    // Clear removed status only for nodes the user NEWLY re-selected (not on every re-render)
    if (isInChatContext && usePreloadedGraphData && selectedEntityIds && removedNodeIdsRef.current.size > 0) {
      const prevSet = new Set(prevSelectedEntityIdsRef.current);
      const newlyAdded = selectedEntityIds.filter(id => !prevSet.has(id));
      if (newlyAdded.length > 0) {
        const reselectedNeoIds = new Set(
          enumerationData!.graphData!.nodes
            .filter(n => newlyAdded.includes(n.properties?.id))
            .map(n => n.id)
        );
        for (const neoId of reselectedNeoIds) {
          removedNodeIdsRef.current.delete(neoId);
        }
      }
    }
    prevSelectedEntityIdsRef.current = selectedEntityIds ?? [];

    // Build queryData by merging available data sources (pre-loaded table data + citation anchors)
    let queryData;
    if (isInChatContext && usePreloadedGraphData) {
      // Start with table-selected entities from pre-loaded data
      const hasTableSelection = selectedEntityIds && selectedEntityIds.length > 0;
      let tableNodes: any[] = [];
      let tableEdges: any[] = [];

      if (hasTableSelection) {
        // Evidence mode: two independent axes — checked nodes (selectedEntityIds) AND checked edges
        // (selectedEdgeKeys), with endpoint integrity (an edge renders only when its key is checked
        // and both endpoints are checked nodes). Unchecking a node drops its edges.
        // Enumeration mode: single node axis, edge-complete so a selected node's edges still render
        // its neighbors.
        const sub = evidenceMode
          ? buildEvidenceSubgraph(enumerationData!.graphData!, selectedEntityIds!, selectedEdgeKeys)
          : buildSelectedSubgraph(enumerationData!.graphData!, selectedEntityIds!, true);
        tableNodes = sub.nodes;
        tableEdges = sub.edges;
      }

      if (hasTableSelection) {
        queryData = { network: { nodes: tableNodes, edges: tableEdges } };
      } else {
        // No table selection — clear graph
        setGraphData({ nodes: [], edges: [] });
        return;
      }
    } else if (isInChatContext) {
      if (enumerationData) {
        // enumerationData exists but no graphData (all unchecked) — clear graph
        setGraphData({ nodes: [], edges: [] });
        return;
      } else {
        queryData = chatNetworkQuery.data;
      }
    } else {
      queryData = graphQuery.data;
    }
    if (queryData?.network) {
      const data = queryData.network;
      // Build documentColorMap for chunk/document coloring
      const documentColorMap = new Map<string, string>();
      const documentNodes = data.nodes.filter((n: GraphNode) => n.labels?.includes('Document'));
      const chunkNodes = data.nodes.filter((n: GraphNode) => n.labels?.includes('Chunk'));

      // Collect unique doc IDs from chunks AND any other nodes with documentId
      // (in inter-only mode, chunks may not be present but entities/concepts have documentId)
      const uniqueChunkDocIds = [...new Set(data.nodes
        .filter((n: any) => n.properties?.documentId && !n.labels?.includes('Document'))
        .map((n: any) => n.properties.documentId))];

      const usedColors = new Set<string>();

      uniqueChunkDocIds.forEach((docId: any) => {
        let colorIndex = getColorIndexFromDocId(docId as string);
        let color = chunkColorPalette[colorIndex];

        // Handle hash collisions - if color already used, find next available
        let attempts = 0;
        while (usedColors.has(color) && attempts < chunkColorPalette.length) {
          colorIndex = (colorIndex + 1) % chunkColorPalette.length;
          color = chunkColorPalette[colorIndex];
          attempts++;
        }

        documentColorMap.set(docId as string, color);
        usedColors.add(color);
      });

      // Also add Document nodes that aren't already in the map (using their id property)
      // This ensures documents get colors even when no chunks are present
      documentNodes.forEach((docNode: GraphNode) => {
        const docId = docNode.properties?.id;
        if (docId && !documentColorMap.has(docId)) {
          let colorIndex = getColorIndexFromDocId(docId);
          let color = chunkColorPalette[colorIndex];

          // Handle hash collisions - if color already used, find next available
          let attempts = 0;
          while (usedColors.has(color) && attempts < chunkColorPalette.length) {
            colorIndex = (colorIndex + 1) % chunkColorPalette.length;
            color = chunkColorPalette[colorIndex];
            attempts++;
          }

          documentColorMap.set(docId, color);
          usedColors.add(color);
        }
      });

      // Store in ref for expand handler to use
      documentColorMapRef.current = documentColorMap;

      // Build document legend (color -> document name + chunk count)
      // Include all documents that have colors assigned
      const allDocIds = [...documentColorMap.keys()];
      const legend: Array<{ color: string; borderColor: string; name: string; count: number }> = [];
      allDocIds.forEach((docId) => {
        const color = documentColorMap.get(docId) || '#DDA0DD';
        const borderColor = darkenColor(color, 25);
        // Count chunks for this document
        const chunkCount = chunkNodes.filter((c: GraphNode) => c.properties?.documentId === docId).length;
        // Find the document node with this ID
        const docNode = documentNodes.find((n: GraphNode) => n.properties?.id === docId);
        // Get filename and clean it up (remove path, remove extension)
        let name = '';
        if (docNode?.properties?.filename) {
          const filename = docNode.properties.filename.split('/').pop() || docNode.properties.filename;
          // Remove extension
          name = filename.replace(/\.[^/.]+$/, '');
        } else if (docNode?.properties?.name) {
          name = docNode.properties.name;
        } else {
          name = `Doc ${docId.substring(0, 8)}...`;
        }
        legend.push({ color, borderColor, name, count: chunkCount });
      });
      // Fallback: if legend is empty but we have chunks with documentId,
      // build legend entries using document names from all available nodes
      if (legend.length === 0 && documentColorMap.size > 0) {
        // Search all data nodes for Document nodes (they may exist but not have matched earlier)
        const allDocNodes = data.nodes.filter((n: any) => n.labels?.includes('Document'));
        for (const [docId, color] of documentColorMap.entries()) {
          const borderColor = darkenColor(color, 25);
          const count = chunkNodes.filter((c: GraphNode) => c.properties?.documentId === docId).length;
          const docNode = allDocNodes.find((n: any) => n.properties?.id === docId);
          const name = docNode?.properties?.filename?.split('/').pop()?.replace(/\.[^/.]+$/, '')
            || docNode?.properties?.name
            || docNode?.label
            || `Doc ${docId.substring(0, 8)}...`;
          legend.push({ color, borderColor, name, count });
        }
      }
      setDocumentLegend(legend);

      // Build docId → name map for detail panels
      const nameMap = new Map<string, string>();
      for (const [docId] of documentColorMap.entries()) {
        const entry = legend.find(l => l.color === documentColorMap.get(docId));
        if (entry && !entry.name.startsWith('Doc ')) {
          nameMap.set(docId, entry.name);
        }
      }
      // Also add from Document nodes directly
      for (const docNode of data.nodes.filter((n: any) => n.labels?.includes('Document'))) {
        const docId = docNode.properties?.id;
        if (docId && !nameMap.has(docId)) {
          const name = docNode.properties?.filename?.split('/').pop()?.replace(/\.[^/.]+$/, '')
            || docNode.properties?.name || docNode.label;
          if (name) {nameMap.set(docId, name);}
        }
      }
      documentNameMapRef.current = nameMap;

      const formattedNodes = data.nodes.map((node: GraphNode) => formatNode(node, documentColorMap));

      // Filter out PREVIOUS edges when a corresponding NEXT edge exists
      // (NEXT and PREVIOUS are redundant - they represent the same relationship)
      const nextEdgeKeys = new Set(
        data.edges
          .filter((e: GraphEdge) => e.type === 'NEXT')
          .map((e: GraphEdge) => `${e.from}-${e.to}`)
      );
      const filteredEdges = data.edges.filter((edge: GraphEdge) => {
        if (edge.type === 'PREVIOUS') {
          // Check if there's a NEXT edge going the opposite direction
          const reverseKey = `${edge.to}-${edge.from}`;
          return !nextEdgeKeys.has(reverseKey);
        }
        return true;
      });

      // Create a lookup map for nodes by ID for edge coloring
      const nodeById = new Map<number, GraphNode>(data.nodes.map((n: GraphNode) => [n.id, n]));

      const formattedEdges = filteredEdges.map((edge: GraphEdge) => {
        const isIdentity = edge.type === 'IDENTITY';
        const isContains = edge.type === 'CONTAINS';
        // Use relationType property if available, otherwise fall back to edge type
        const _hasRelationType = !!edge.properties?.relationType;
        const edgeLabel = isContains ? '' : (edge.properties?.relationType || edge.type);

        // For CONTAINS edges, use the chunk's document color
        let edgeColor = '#666666';
        if (isContains) {
          // CONTAINS edges can go either direction depending on query/expansion
          const toNode = nodeById.get(edge.to);
          const fromNode = nodeById.get(edge.from);
          // Find which node is the chunk (has documentId property)
          const chunkNode = toNode?.properties?.documentId ? toNode : fromNode;
          const chunkDocId = chunkNode?.properties?.documentId;
          edgeColor = chunkDocId ? (documentColorMap.get(chunkDocId) || '#DDA0DD') : '#DDA0DD';
        }

        return {
          ...edge,
          label: edgeLabel,
          color: edgeColor,
          width: isContains ? 1 : 3, // CONTAINS thin, others thicker
          font: { color: '#ffffff', strokeWidth: 0 },
          dashes: isIdentity ? [15, 5] : undefined, // Longer dashes for identity (=== style)
          arrows: isIdentity ? { to: false, from: false } : { to: true }, // No arrows for identity
          title: `${isIdentity ? '🔀 IDENTITY (same entity)\n' : ''}${edge.type}\n${JSON.stringify(edge.properties, null, 2)}`,
        };
      });

      // Filter out explicitly removed nodes
      let finalNodes = formattedNodes;
      let finalEdges = formattedEdges;
      if (isInChatContext && removedNodeIdsRef.current.size > 0) {
        finalNodes = finalNodes.filter((n: any) => !removedNodeIdsRef.current.has(n.id));
        const nodeIds = new Set(finalNodes.map((n: any) => n.id));
        finalEdges = finalEdges.filter((e: any) => nodeIds.has(e.from) && nodeIds.has(e.to));
      }

      const newBaseData = { nodes: finalNodes, edges: finalEdges };

      // Store base data as original for reset functionality (only in chat context)
      if (isInChatContext) {
        originalGraphDataRef.current = newBaseData;
      }

      // Merge: preserve interactive nodes (added via Connect/Expand) from previous state
      if (isInChatContext) {
        setGraphData(prev => mergeBaseWithInteractive(prev, newBaseData, removedNodeIdsRef.current));
      } else {
        setGraphData(newBaseData);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphQuery.data, chatNetworkQuery.data, isInChatContext, selectedEntityIds, selectedEdgeKeys, enumerationData?.graphData, usePreloadedGraphData]);

  // #19: Auto-pull edges between newly added table nodes and existing interactive
  // nodes (from expand/connect). The main effect above only has access to
  // enumerationData edges — it can't know about edges to nodes added via expansion.
  // This effect runs after graphData is set, detects table nodes that coexist with
  // interactive nodes, and fetches cross-edges from Neo4j.
  const crossEdgeFetchedRef = useRef<string>('');
  useEffect(() => {
    if (!isInChatContext || !usePreloadedGraphData || !documentIds || documentIds.length === 0) {
      return;
    }
    if (!selectedEntityIds || selectedEntityIds.length === 0) {
      crossEdgeFetchedRef.current = '';
      return;
    }

    const idSet = new Set(selectedEntityIds);
    const tableNodeNeoIds = enumerationData?.graphData?.nodes
      .filter(n => idSet.has(n.properties?.id))
      .map(n => n.id) ?? [];

    if (tableNodeNeoIds.length === 0) {
      return;
    }

    // Interactive nodes = nodes in graphData that are NOT from the current table selection
    const tableNeoIdSet = new Set(tableNodeNeoIds);
    const interactiveNodeNeoIds = graphData.nodes
      .filter((n: any) => !tableNeoIdSet.has(n.id))
      .map((n: any) => n.id);

    if (interactiveNodeNeoIds.length === 0) {
      return;
    }

    // Dedupe: skip if we already fetched for this exact combination
    const fetchKey = `${tableNodeNeoIds.sort().join(',')}-${interactiveNodeNeoIds.sort().join(',')}`;
    if (crossEdgeFetchedRef.current === fetchKey) {
      return;
    }

    crossEdgeFetchedRef.current = fetchKey;

    edgesBetween.fetch({
      documentIds,
      newNodeNeoIds: tableNodeNeoIds,
      existingNodeNeoIds: interactiveNodeNeoIds,
    }).then(result => {
      if (result.edges.length === 0) {
        return;
      }
      setGraphData(prev => {
        const existingEdgeKeys = new Set(prev.edges.map(e => {
          const ids = [e.from, e.to].sort((a, b) => a - b);
          return `${ids[0]}-${e.type}-${ids[1]}`;
        }));
        const nodeById = new Map(prev.nodes.map(n => [n.id, n]));
        const newEdges = result.edges
          .filter(e => {
            const ids = [e.from, e.to].sort((a, b) => a - b);
            return !existingEdgeKeys.has(`${ids[0]}-${e.type}-${ids[1]}`);
          })
          .map(e => {
            const isIdentity = e.type === 'IDENTITY';
            const isContains = e.type === 'CONTAINS';
            const edgeLabel = isContains ? '' : (e.properties?.relationType || e.type);

            let edgeColor = '#666666';
            if (isContains) {
              const toNode = nodeById.get(e.to);
              const fromNode = nodeById.get(e.from);
              const chunkNode = toNode?.properties?.documentId ? toNode : fromNode;
              const chunkDocId = chunkNode?.properties?.documentId;
              edgeColor = chunkDocId ? (documentColorMapRef.current.get(chunkDocId) || '#DDA0DD') : '#DDA0DD';
            }

            return {
              ...e,
              label: edgeLabel,
              color: edgeColor,
              width: isContains ? 1 : 3,
              font: { color: '#ffffff', strokeWidth: 0 },
              dashes: isIdentity ? [15, 5] : undefined,
              arrows: isIdentity ? { to: false, from: false } : { to: true },
              title: `${isIdentity ? '🔀 IDENTITY (same entity)\n' : ''}${e.type}\n${JSON.stringify(e.properties, null, 2)}`,
            };
          });
        if (newEdges.length === 0) {
          return prev;
        }
        return {
          nodes: prev.nodes,
          edges: [...prev.edges, ...newEdges],
        };
      });
    }).catch(() => {
      // Cross-edge fetch is best-effort; don't break the graph if it fails
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInChatContext, usePreloadedGraphData, documentIds, selectedEntityIds, graphData.nodes]);

  // Handler for node expansion (called from button in node details)
  const handleNodeExpand = async (nodeId: number, skipSelection = false) => {
    // Skip if already expanded
    if (expandedNodes.has(nodeId)) {
      return;
    }

    setIsExpandingNode(true);
    try {
      let neighbors: GraphNode[] = [];
      let newEdges: GraphEdge[] = [];

      if (isInChatContext && documentIds && documentIds.length > 0) {
        // Chat context: use the documentIds-scoped API
        const result = await nodeNeighbors.fetch({
          documentIds,
          nodeNeoId: nodeId,
        });
        neighbors = result.neighbors as GraphNode[];
        newEdges = result.edges as GraphEdge[];
      } else {
        // Settings context: use Cypher query to get neighbors from entire graph
        // Set flag to prevent main useEffect from overwriting graphData
        isExpandingRef.current = true;
        const cypherQuery = `
          MATCH (n)-[r]-(m) WHERE id(n) = ${nodeId}
          RETURN m, labels(m) as mLabels, properties(m) as mProperties, id(m) as mId,
                 r, type(r) as rType, properties(r) as rProperties, id(n) as nId
          LIMIT 50
        `;
        const result = await expandQuery.mutateAsync({ query: cypherQuery });
        // Note: flag reset happens after setGraphData below

        // Transform results into neighbors and edges
        const neighborsMap = new Map<number, GraphNode>();
        for (const record of result.results) {
          if (record.mId !== undefined) {
            const mId = typeof record.mId === 'object' && record.mId.low !== undefined
              ? record.mId.low
              : parseInt(record.mId.toString());

            if (!neighborsMap.has(mId)) {
              const primaryLabel = record.mLabels?.[0] || 'Node';
              neighborsMap.set(mId, {
                id: mId,
                label: record.mProperties?.name || record.mProperties?.title || `${primaryLabel}-${mId}`,
                labels: record.mLabels || [],
                properties: record.mProperties || {},
                group: primaryLabel,
              });
            }

            // Add edge
            const nId = typeof record.nId === 'object' && record.nId.low !== undefined
              ? record.nId.low
              : parseInt(record.nId.toString());
            newEdges.push({
              from: nId,
              to: mId,
              label: record.rType || 'RELATED',
              type: record.rType || 'RELATED',
              properties: record.rProperties || {},
            });
          }
        }
        neighbors = Array.from(neighborsMap.values());
      }

      const result = { neighbors, edges: newEdges };

      // Track counts before state update for notification
      let addedNodesCount = 0;
      let addedEdgesCount = 0;

      // Merge new nodes and edges into existing graph
      setGraphData(prev => {
        const existingNodeIds = new Set(prev.nodes.map(n => n.id));
        const existingEdgeKeys = new Set(prev.edges.map(e => {
          const ids = [e.from, e.to].sort((a, b) => a - b);
          return `${ids[0]}-${e.type}-${ids[1]}`;
        }));

        // Add new neighbors that don't already exist, using shared formatNode function
        const newNodes = result.neighbors
          .filter(n => !existingNodeIds.has(n.id))
          .map(n => ({ ...formatNode(n as GraphNode, documentColorMapRef.current), isInteractive: true }));

        // Build set of NEXT edges (existing + new) to filter out redundant PREVIOUS edges
        const allNextEdgeKeys = new Set([
          ...prev.edges.filter(e => e.type === 'NEXT').map(e => `${e.from}-${e.to}`),
          ...result.edges.filter(e => e.type === 'NEXT').map(e => `${e.from}-${e.to}`),
        ]);

        // Create a combined node lookup for edge coloring (existing + new neighbors)
        const allNodesById = new Map([
          ...prev.nodes.map(n => [n.id, n] as [number, any]),
          ...result.neighbors.map(n => [n.id, n] as [number, GraphNode]),
        ]);

        // Add new edges that don't already exist and aren't redundant PREVIOUS edges
        const newEdges = result.edges
          .filter(e => {
            // Filter out PREVIOUS edges when corresponding NEXT exists
            if (e.type === 'PREVIOUS') {
              const reverseKey = `${e.to}-${e.from}`;
              if (allNextEdgeKeys.has(reverseKey)) {
                return false;
              }
            }
            const ids = [e.from, e.to].sort((a, b) => a - b);
            const key = `${ids[0]}-${e.type}-${ids[1]}`;
            return !existingEdgeKeys.has(key);
          })
          .map(e => {
            const isIdentity = e.type === 'IDENTITY';
            const isContains = e.type === 'CONTAINS';
            // Use relationType property if available, otherwise fall back to edge type
            const _hasRelationType = !!e.properties?.relationType;
            const edgeLabel = isContains ? '' : (e.properties?.relationType || e.type);

            // For CONTAINS edges, use the chunk's document color
            let edgeColor = '#666666';
            if (isContains) {
              // CONTAINS edges can go either direction depending on expansion
              const toNode = allNodesById.get(e.to);
              const fromNode = allNodesById.get(e.from);
              // Find which node is the chunk (has documentId property)
              const chunkNode = toNode?.properties?.documentId ? toNode : fromNode;
              const chunkDocId = chunkNode?.properties?.documentId;
              edgeColor = chunkDocId ? (documentColorMapRef.current.get(chunkDocId) || '#DDA0DD') : '#DDA0DD';
            }

            return {
              ...e,
              isInteractive: true,
              label: edgeLabel,
              color: edgeColor,
              width: isContains ? 1 : 3,
              font: { color: '#ffffff', strokeWidth: 0 },
              dashes: isIdentity ? [15, 5] : undefined,
              arrows: isIdentity ? { to: false, from: false } : { to: true },
              title: `${isIdentity ? '🔀 IDENTITY (same entity)\n' : ''}${e.type}\n${JSON.stringify(e.properties, null, 2)}`,
            };
          });

        if (newNodes.length === 0 && newEdges.length === 0) {
          // Mark this node as fully expanded (no more neighbors to show)
          setFullyExpandedNodes(prevSet => new Set([...prevSet, nodeId]));
          return prev;
        }

        // Store counts for notification (outside setState)
        addedNodesCount = newNodes.length;
        addedEdgesCount = newEdges.length;

        // Track what was added for collapse support
        const addedNodeIds = newNodes.map(n => n.id);
        const addedEdgeKeys = newEdges.map(e => {
          const ids = [e.from, e.to].sort((a, b) => a - b);
          return `${ids[0]}-${e.type}-${ids[1]}`;
        });

        setExpandedNodes(prevExpanded => {
          const next = new Map(prevExpanded);
          next.set(nodeId, { nodeIds: addedNodeIds, edgeKeys: addedEdgeKeys });
          return next;
        });

        // Keep the node selected after data updates
        if (!skipSelection) {
        setTimeout(() => {
          if (networkInstance.current) {
            safeSetSelection({ nodes: [nodeId], edges: [] }, { highlightEdges: false });
          }
        }, 100);
        }

        return {
          nodes: [...prev.nodes, ...newNodes],
          edges: [...prev.edges, ...newEdges],
        };
      });

      // Show notification after state update completes
      setTimeout(() => {
        notifications.show({
          message: `+${addedNodesCount} nodes, +${addedEdgesCount} edges`,
          color: 'teal',
          autoClose: 1500,
          withCloseButton: false,
        });
      }, 0);
    } catch (error) {
      setTimeout(() => {
        notifications.show({
          message: 'Expansion failed',
          color: 'red',
          autoClose: 2000,
          withCloseButton: false,
        });
      }, 0);
    } finally {
      setIsExpandingNode(false);
      // Reset the expanding flag after a short delay to ensure useEffect has checked it
      // This prevents the main useEffect from overwriting graphData with expansion query results
      setTimeout(() => {
        isExpandingRef.current = false;
      }, 100);
    }
  };

  // Handler for node isolation (fetches neighbors and replaces graph)
  // Narrow the visible canvas to the given node ids without fetching anything.
  // Use Expand afterward to bring in neighbors. graphData is unchanged — the
  // render filter (see useEffect below) hides everything not in this set or
  // added later via expansion. Pass [] to clear isolation.
  const handleIsolate = (nodeIds: number[]) => {
    if (nodeIds.length === 0) {
      setIsolatedNodeIds([]);
      return;
    }
    if (networkInstance.current) {
      const positions = networkInstance.current.getPositions();
      savedPositionsRef.current = new Map(
        Object.entries(positions).map(([id, pos]) => [
          Number(id),
          pos as { x: number; y: number },
        ])
      );
    }
    setIsolatedNodeIds(nodeIds);
    setIsolatedEdge(null);
    setExpandedNodes(new Map());
    setFullyExpandedNodes(new Set());
  };

  // Handler for node collapse (removes nodes/edges added by expansion)
  const handleNodeCollapse = (nodeId: number) => {
    const expansionData = expandedNodes.get(nodeId);
    if (!expansionData) {
      return;
    }

    const { nodeIds: addedNodeIds, edgeKeys: addedEdgeKeys } = expansionData;
    const nodesToRemove = new Set(addedNodeIds);
    const edgesToRemove = new Set(addedEdgeKeys);

    setGraphData(prev => {
      const filteredNodes = prev.nodes.filter(n => !nodesToRemove.has(n.id));
      const filteredEdges = prev.edges.filter(e => {
        const ids = [e.from, e.to].sort((a, b) => a - b);
        const key = `${ids[0]}-${e.type}-${ids[1]}`;
        return !edgesToRemove.has(key);
      });

      return {
        nodes: filteredNodes,
        edges: filteredEdges,
      };
    });

    // Remove from expanded tracking
    setExpandedNodes(prev => {
      const next = new Map(prev);
      next.delete(nodeId);
      return next;
    });

    setTimeout(() => {
      notifications.show({
        message: `-${addedNodeIds.length} nodes`,
        color: 'gray',
        autoClose: 1500,
        withCloseButton: false,
      });
    }, 0);

    // Preserve the existing selection minus anything that was just collapsed.
    // Don't replace with just [nodeId] — that would drop all other selected nodes
    // from vis-network, desyncing it from React state (the multi-select panel).
    setTimeout(() => {
      if (networkInstance.current) {
        const survivingNodeIds = [...selectedNodeIdsRef.current].filter(id => !nodesToRemove.has(id));
        const survivingEdgeIds = [...selectedEdgeIdsRef.current].filter(eid => !edgesToRemove.has(eid));
        safeSetSelection(
          { nodes: survivingNodeIds, edges: survivingEdgeIds },
          { highlightEdges: false },
        );
      }
    }, 100);
  };

  const handleRemoveSelected = () => {
    const nodeIdsToRemove = new Set(selectedNodes.map(n => n.id));
    const edgeKeysToRemove = new Set(selectedEdges.map(e => {
      const ids = [e.from, e.to].sort((a, b) => a - b);
      return `${ids[0]}-${e.type}-${ids[1]}`;
    }));

    let removedNodes = 0;
    let removedEdges = 0;

    setGraphData(prev => {
      const newNodes = prev.nodes.filter(n => !nodeIdsToRemove.has(n.id));
      const newEdges = prev.edges.filter(e => {
        // Remove explicitly selected edges
        const ids = [e.from, e.to].sort((a, b) => a - b);
        const key = `${ids[0]}-${e.type}-${ids[1]}`;
        if (edgeKeysToRemove.has(key)) {return false;}
        // Remove edges connected to removed nodes
        if (nodeIdsToRemove.has(e.from) || nodeIdsToRemove.has(e.to)) {return false;}
        return true;
      });

      removedNodes = prev.nodes.length - newNodes.length;
      removedEdges = prev.edges.length - newEdges.length;
      return { nodes: newNodes, edges: newEdges };
    });

    // Clear removed nodes from expansion tracking
    setExpandedNodes(prev => {
      const next = new Map(prev);
      for (const nodeId of nodeIdsToRemove) {
        next.delete(nodeId);
      }
      return next;
    });
    setFullyExpandedNodes(prev => {
      const next = new Set(prev);
      for (const nodeId of nodeIdsToRemove) {
        next.delete(nodeId);
      }
      return next;
    });

    // Track removed nodes so the formatting useEffect doesn't re-add them
    for (const nodeId of nodeIdsToRemove) {
      removedNodeIdsRef.current.add(nodeId);
    }

    // Uncheck removed nodes in the table
    if (onEntitySelectionChange && selectedEntityIds) {
      const removedEntityUuids = new Set(
        selectedNodes
          .filter(n => n.properties?.id)
          .map(n => n.properties.id as string)
      );
      if (removedEntityUuids.size > 0) {
        onEntitySelectionChange(selectedEntityIds.filter(id => !removedEntityUuids.has(id)));
      }
    }

    // Clear selection
    setSelectedNodes([]);
    setSelectedEdges([]);

    setTimeout(() => {
      notifications.show({
        message: `-${removedNodes} nodes, -${removedEdges} edges`,
        color: 'gray',
        autoClose: 2000,
        withCloseButton: false,
      });
    }, 0);
  };

  // Select-on-graph (table → canvas operation-set): map the table's filtered entity UUIDs to the
  // nodes currently rendered on the canvas and toggle them into the op-set (selectedNodes), mirroring
  // the table's select-all toggle — if every match is already selected, deselect them; otherwise
  // union them in. This is the bulk-op target channel from #83, independent of graph membership
  // (the checkbox). Only on-canvas nodes can be op-selected; any filtered entity not on the graph is
  // reported, never silently dropped.
  const handleSelectEntitiesOnGraph = (entityIds: string[]) => {
    const set = new Set(entityIds);
    const matched = graphDataRef.current.nodes.filter(n => n.properties?.id && set.has(n.properties.id));
    setSelectedNodes(prev => {
      const prevIds = new Set(prev.map(n => n.id));
      const allAlready = matched.length > 0 && matched.every(n => prevIds.has(n.id));
      const next = allAlready
        ? prev.filter(n => !matched.some(m => m.id === n.id))
        : [...prev, ...matched.filter(m => !prevIds.has(m.id))];
      safeSetSelection(
        { nodes: next.map(n => n.id), edges: [...selectedEdgeIdsRef.current] },
        { highlightEdges: false },
      );
      return next;
    });
    // Surface the "not on the graph" notice only for a bulk action; a single row click that misses
    // is a quiet no-op (off-graph rows aren't clickable, so this is the rare canvas-driven case).
    if (set.size > 1 && matched.length < set.size) {
      notifications.show({
        message: `Selected ${matched.length} of ${set.size} — ${set.size - matched.length} not on the graph; add them first`,
        color: 'yellow',
        autoClose: 3000,
      });
    }
  };

  // Edge analog of handleSelectEntitiesOnGraph: map the relationship table's UUID-space edge keys
  // to the rendered canvas edges via the tested edgeToKey bridge, then toggle them into the edge
  // operation-set (selectedEdges). Sourcing from graphDataRef.current.edges makes endpoint integrity
  // automatic — an off-canvas edge can't match — mirroring buildEvidenceSubgraph's filter shape.
  const handleSelectEdgesOnGraph = (uuidEdgeKeys: string[]) => {
    const wanted = new Set(uuidEdgeKeys);
    const byNeoId = new Map<number, GraphNode>(graphDataRef.current.nodes.map(n => [n.id, n]));
    const matched = graphDataRef.current.edges.filter(e => {
      const k = edgeToKey(e, byNeoId);
      return k !== null && wanted.has(k);
    });
    setSelectedEdges(prev => {
      const prevKeys = new Set(prev.map(getEdgeKey));
      const allAlready = matched.length > 0 && matched.every(e => prevKeys.has(getEdgeKey(e)));
      const next = allAlready
        ? prev.filter(e => !matched.some(m => getEdgeKey(m) === getEdgeKey(e)))
        : [...prev, ...matched.filter(m => !prevKeys.has(getEdgeKey(m)))];
      safeSetSelection(
        { nodes: [...selectedNodeIdsRef.current], edges: next.map(getEdgeKey) },
        { highlightEdges: false },
      );
      return next;
    });
    if (wanted.size > 1 && matched.length < wanted.size) {
      notifications.show({
        message: `Selected ${matched.length} of ${wanted.size} relationships — ${wanted.size - matched.length} not on the graph; add them first`,
        color: 'yellow',
        autoClose: 3000,
      });
    }
  };

  const handleConnectNodes = async () => {
    if (selectedNodes.length < 2) {return;}

    setIsConnecting(true);
    try {
      let allPathNodes: GraphNode[] = [];
      let allPathEdges: GraphEdge[] = [];
      let noPathCount = 0;

      if (isInChatContext && documentIds && documentIds.length > 0) {
        const result = await findShortestPath.fetch({
          documentIds,
          nodeNeoIds: selectedNodes.map(n => n.id),
        });

        for (const path of result.paths) {
          allPathNodes.push(...(path.nodes as GraphNode[]));
          allPathEdges.push(...(path.edges as GraphEdge[]).map(e => ({ ...e, isShortestPath: true })));
        }

        noPathCount = result.noPathPairs.length;
        if (result.noPathPairs.length > 0) {
          const noPathNames = result.noPathPairs.map(p => {
            const startNode = graphData.nodes.find(n => n.id === p.startNeoId);
            const endNode = graphData.nodes.find(n => n.id === p.endNeoId);
            return `${startNode?.label || p.startNeoId} ↔ ${endNode?.label || p.endNeoId}`;
          });
          notifications.show({
            title: 'No path found',
            message: noPathNames.join(', '),
            color: 'yellow',
            autoClose: 4000,
          });
        }
      } else {
        // Settings context: run Cypher directly for each pair
        isExpandingRef.current = true;
        const pairs: Array<{ startId: number; endId: number }> = [];
        for (let i = 0; i < selectedNodes.length; i++) {
          for (let j = i + 1; j < selectedNodes.length; j++) {
            pairs.push({ startId: selectedNodes[i].id, endId: selectedNodes[j].id });
          }
        }

        for (const { startId, endId } of pairs) {
          try {
            const cypherQuery = `
              MATCH (a), (b)
              WHERE id(a) = ${startId} AND id(b) = ${endId}
              MATCH p = shortestPath((a)-[*1..5]-(b))
              UNWIND nodes(p) AS node
              WITH p, node
              OPTIONAL MATCH (node)-[r]-(other)
              WHERE other IN nodes(p)
              RETURN DISTINCT
                id(node) AS nId, labels(node) AS nLabels, properties(node) AS nProps,
                type(r) AS rType, properties(r) AS rProps,
                id(startNode(r)) AS rFrom, id(endNode(r)) AS rTo
            `;
            const result = await expandQuery.mutateAsync({ query: cypherQuery });

            const nodesMap = new Map<number, GraphNode>();
            const edgesMap = new Map<string, GraphEdge>();

            for (const record of result.results) {
              const nId = typeof record.nId === 'object' && record.nId.low !== undefined
                ? record.nId.low : parseInt(record.nId?.toString() || '0');
              if (!nodesMap.has(nId)) {
                const primaryLabel = record.nLabels?.[0] || 'Node';
                nodesMap.set(nId, {
                  id: nId,
                  label: record.nProps?.name || record.nProps?.title || `${primaryLabel}-${nId}`,
                  labels: record.nLabels || [],
                  properties: record.nProps || {},
                  group: primaryLabel,
                });
              }
              if (record.rType) {
                const fromId = typeof record.rFrom === 'object' && record.rFrom.low !== undefined
                  ? record.rFrom.low : parseInt(record.rFrom?.toString() || '0');
                const toId = typeof record.rTo === 'object' && record.rTo.low !== undefined
                  ? record.rTo.low : parseInt(record.rTo?.toString() || '0');
                const sorted = [fromId, toId].sort((a, b) => a - b);
                const key = `${sorted[0]}-${record.rType}-${sorted[1]}`;
                if (!edgesMap.has(key)) {
                  edgesMap.set(key, {
                    from: fromId, to: toId,
                    label: record.rType, type: record.rType,
                    properties: record.rProps || {},
                    isShortestPath: true,
                  });
                }
              }
            }
            allPathNodes.push(...Array.from(nodesMap.values()));
            allPathEdges.push(...Array.from(edgesMap.values()));
          } catch {
            noPathCount += 1;
            const startNode = graphData.nodes.find(n => n.id === startId);
            const endNode = graphData.nodes.find(n => n.id === endId);
            notifications.show({
              title: 'No path found',
              message: `${startNode?.label || startId} ↔ ${endNode?.label || endId}`,
              color: 'yellow',
              autoClose: 4000,
            });
          }
        }
      }

      // Merge path nodes/edges into graph
      let addedNodesCount = 0;
      let addedEdgesCount = 0;
      if (allPathNodes.length > 0 || allPathEdges.length > 0) {
        setGraphData(prev => {
          const existingNodeIds = new Set(prev.nodes.map(n => n.id));
          const existingEdgeKeys = new Set(prev.edges.map(e => {
            const ids = [e.from, e.to].sort((a, b) => a - b);
            return `${ids[0]}-${e.type}-${ids[1]}`;
          }));

          const newNodes = allPathNodes
            .filter(n => !existingNodeIds.has(n.id))
            .filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i)
            .map(n => ({ ...formatNode(n, documentColorMapRef.current), isInteractive: true }));

          const newEdges = allPathEdges
            .filter(e => {
              const ids = [e.from, e.to].sort((a, b) => a - b);
              const key = `${ids[0]}-${e.type}-${ids[1]}`;
              return !existingEdgeKeys.has(key);
            })
            .filter((e, i, arr) => {
              const ids = [e.from, e.to].sort((a, b) => a - b);
              const key = `${ids[0]}-${e.type}-${ids[1]}`;
              return arr.findIndex(x => {
                const xIds = [x.from, x.to].sort((a, b) => a - b);
                return `${xIds[0]}-${x.type}-${xIds[1]}` === key;
              }) === i;
            })
            .map(e => {
              const isIdentity = e.type === 'IDENTITY';
              const isContains = e.type === 'CONTAINS';
              const edgeLabel = isContains ? '' : (e.properties?.relationType || e.type);
              return {
                ...e,
                isShortestPath: true,
                isInteractive: true,
                label: edgeLabel,
                color: '#666666',
                width: isContains ? 1 : 3,
                font: { color: '#ffffff', strokeWidth: 0 },
                dashes: isIdentity ? [15, 5] : undefined,
                arrows: isIdentity ? { to: false, from: false } : { to: true },
                title: `${e.type}\n${JSON.stringify(e.properties, null, 2)}`,
              };
            });

          addedNodesCount = newNodes.length;
          addedEdgesCount = newEdges.length;

          return {
            nodes: [...prev.nodes, ...newNodes],
            edges: [...prev.edges, ...newEdges],
          };
        });

        // Reset the expanding ref after state update
        isExpandingRef.current = false;

        // If isolated, the new bridge nodes wouldn't pass the isolation filter
        // (it only shows isolatedNodeIds + expansion). Fold every path node
        // into the isolated set so Connect's results actually become visible.
        setIsolatedNodeIds(prev => {
          if (prev.length === 0) {return prev;}
          const next = new Set(prev);
          for (const n of allPathNodes) {next.add(n.id);}
          return [...next];
        });

        // Store path info for tracking
        const pathKey = selectedNodes.map(n => n.id).sort((a, b) => a - b).join('-');
        setConnectedPaths(prev => {
          const next = new Map(prev);
          next.set(pathKey, {
            nodeIds: allPathNodes.map(n => n.id),
            edgeKeys: allPathEdges.map(e => {
              const ids = [e.from, e.to].sort((a, b) => a - b);
              return `${ids[0]}-${e.type}-${ids[1]}`;
            }),
          });
          return next;
        });

        if (addedNodesCount > 0 || addedEdgesCount > 0) {
          // Temporarily enable full physics to redistribute layout, then freeze
          setTimeout(() => {
            if (networkInstance.current) {
              networkInstance.current.setOptions({ physics: fullPhysics });
              networkInstance.current.once('stabilizationIterationsDone', () => {
                if (networkInstance.current) {
                  networkInstance.current.setOptions({ physics: { enabled: false } });
                }
              });
              setTimeout(() => {
                if (networkInstance.current) {
                  networkInstance.current.setOptions({ physics: { enabled: false } });
                }
              }, 1500);
            }
          }, 100);

          notifications.show({
            message: `+${addedNodesCount} nodes, +${addedEdgesCount} edges (shortest path)`,
            color: 'teal',
            autoClose: 2000,
            withCloseButton: false,
          });
        }
      }
      // Nothing was added AND every pair did have a path — meaning all the
      // path elements were already on the canvas. Tell the user why nothing
      // visibly changed. (When noPathCount > 0 the existing "No path found"
      // notification has already explained the disconnects.)
      if (addedNodesCount === 0 && addedEdgesCount === 0 && noPathCount === 0) {
        notifications.show({
          message: 'No new connections — selected nodes are already connected on the graph',
          color: 'gray',
          autoClose: 2500,
          withCloseButton: false,
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to find shortest paths',
        color: 'red',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    if (networkRef.current && graphData.nodes.length > 0) {
      // For settings page (not chat context), destroy and recreate network on data change
      // This ensures clean rendering when switching between different filter results
      if (!isInChatContext && networkInstance.current) {
        networkInstance.current.destroy();
        networkInstance.current = null;
      }

      // Prune selected nodes/edges whose IDs are no longer in graphData.
      // Without this, collapse/uncheck/remove-like flows leave phantom entries
      // in the multi-select panel.
      if (selectedNodes.length > 0) {
        const validNodes = selectedNodes.filter(sn => graphData.nodes.find(n => n.id === sn.id));
        if (validNodes.length !== selectedNodes.length) {
          setSelectedNodes(validNodes);
        }
      }
      if (selectedEdges.length > 0) {
        const validEdges = selectedEdges.filter(se => {
          const seKey = getEdgeKey(se);
          return graphData.edges.find(e => getEdgeKey(e) === seKey);
        });
        if (validEdges.length !== selectedEdges.length) {
          setSelectedEdges(validEdges);
        }
      }

      const filteredNodes = visibleGraphNodes;

      const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

      // Filter edges to only include those between visible nodes
      let filteredEdges = graphData.edges.filter(
        edge => filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to)
      );

      // If isolating an edge, only show that specific edge
      if (isolatedEdge !== null) {
        filteredEdges = filteredEdges.filter(
          edge => (edge.from === isolatedEdge.from && edge.to === isolatedEdge.to) ||
                  (edge.from === isolatedEdge.to && edge.to === isolatedEdge.from)
        );
      }

      // Apply saved positions if we're restoring from isolation
      const shouldRestorePositions = isolatedNodeIds.length === 0 && isolatedEdge === null && savedPositionsRef.current.size > 0;

      // Deduplicate nodes by ID before applying positions
      const uniqueNodesMap = new Map<number, any>();
      filteredNodes.forEach(node => {
        if (!uniqueNodesMap.has(node.id)) {
          uniqueNodesMap.set(node.id, node);
        }
      });

      const nodesWithPositions = Array.from(uniqueNodesMap.values()).map(node => {
        const savedPos = savedPositionsRef.current.get(node.id);
        if (shouldRestorePositions && savedPos) {
          return { ...node, x: savedPos.x, y: savedPos.y };
        }
        return node;
      });

      let nodes: DataSet<any>;
      try {
        nodes = new DataSet(nodesWithPositions);
      } catch (error) {
        console.error('[GRAPH-RENDER] Error creating nodes DataSet:', error);
        // If DataSet creation fails, clear duplicates and try again
        const dedupedNodes = nodesWithPositions.filter((node, index, self) =>
          index === self.findIndex(n => n.id === node.id)
        );
        nodes = new DataSet(dedupedNodes);
      }

      // Deduplicate edges based on from, to, and semantic type (handling bidirectional relationships).
      // Uses properties.relationType when present so JSON-ingested edges that share a generic Neo4j
      // type (e.g. RELATED) but carry distinct semantic types don't collapse into a single edge.
      const undirectedKey = (edge: GraphEdge) => {
        const nodeIds = [edge.from, edge.to].sort((a, b) => a - b);
        const semanticType = edge.properties?.relationType || edge.type;
        return `${nodeIds[0]}-${nodeIds[1]}-${semanticType}`;
      };
      const uniqueEdges = filteredEdges.reduce((acc, edge) => {
        const key = undirectedKey(edge);
        const existingEdge = acc.find(e => undirectedKey(e) === key);
        if (!existingEdge) {
          acc.push(edge);
        }
        return acc;
      }, [] as GraphEdge[]);
      
      // Group parallel edges (same node pair, ignoring direction) and assign each one
      // a unique smooth-curve roundness so they fan apart visually instead of stacking.
      // vis-network's global smooth setting only handles a single curve per pair; parallel
      // edges need per-edge roundness to render distinctly.
      const parallelGroupCounts = new Map<string, number>();
      const parallelGroupAssignments = new Map<string, number>();
      for (const edge of uniqueEdges) {
        const pairKey = [edge.from, edge.to].sort((a, b) => a - b).join('-');
        const idx = parallelGroupCounts.get(pairKey) ?? 0;
        parallelGroupAssignments.set(getEdgeKey(edge), idx);
        parallelGroupCounts.set(pairKey, idx + 1);
      }

      const buildEdgeForDataSet = (edge: GraphEdge) => {
        const pairKey = [edge.from, edge.to].sort((a, b) => a - b).join('-');
        const total = parallelGroupCounts.get(pairKey) ?? 1;
        const idx = parallelGroupAssignments.get(getEdgeKey(edge)) ?? 0;
        // For a single edge, draw it nearly straight; for parallel edges, alternate
        // direction (CW/CCW) and increment magnitude so they fan out symmetrically.
        const smooth = total === 1
          ? { enabled: true, type: 'continuous', roundness: 0.05 }
          : {
              enabled: true,
              type: idx % 2 === 0 ? 'curvedCW' : 'curvedCCW',
              roundness: 0.15 + 0.15 * Math.floor(idx / 2),
            };
        return {
          id: getEdgeKey(edge),
          ...edge,
          smooth,
        };
      };

      let edges: DataSet<any>;
      try {
        edges = new DataSet(uniqueEdges.map(buildEdgeForDataSet));
      } catch (error) {
        console.error('[GRAPH-RENDER] Error creating edges DataSet:', error);
        // Fallback: create DataSet with simpler IDs
        edges = new DataSet(uniqueEdges.map((edge, index) => ({
          id: index,
          ...edge,
        })) as any[]);
      }

      if (networkInstance.current) {
        try {
          // Update existing network data without recreating
          networkInstance.current.setData({ nodes, edges });
        } catch (error) {
          console.error('[GRAPH-RENDER] Error updating network data:', error);
          // If update fails, try to recreate the network
          notifications.show({
            message: 'Graph update failed - try refreshing',
            color: 'red',
            autoClose: 3000,
          });
          return;
        }

        // If restoring from isolation, disable physics to keep positions stable
        if (shouldRestorePositions) {
          networkInstance.current.setOptions({ physics: { enabled: false } });
          // Clear saved positions after restoring
          savedPositionsRef.current.clear();
        } else {
          // Run full physics briefly so new nodes lay out instead of stacking,
          // then settle. After settling, respect freeze / active selection —
          // freeze them in place rather than floating again.
          networkInstance.current.setOptions({ physics: fullPhysics });
          let hasFit = false;
          const settlePhysics = () => {
            const userHeld = isGraphFrozenRef.current
              || selectedNodeIdsRef.current.size > 0
              || selectedEdgeIdsRef.current.size > 0;
            networkInstance.current?.setOptions({
              physics: userHeld ? { enabled: false } : getSubtlePhysicsWithSpacing(),
            });
          };
          networkInstance.current.once('stabilizationIterationsDone', () => {
            if (!hasFit) {
              hasFit = true;
              fitGraph();
              settlePhysics();
            }
          });
          // Fallback in case stabilization never fires (e.g. isolated nodes).
          setTimeout(() => {
            if (!hasFit) {
              hasFit = true;
              fitGraph();
              settlePhysics();
            }
          }, 1500);
        }

        // Re-select nodes and edges if any are selected (selection is lost when data changes)
        const validNodeIds = [...selectedNodeIdsRef.current].filter(id => filteredNodeIds.has(id));
        const validEdgeIds = [...selectedEdgeIdsRef.current].filter(eid =>
          uniqueEdges.some(e => getEdgeKey(e) === eid)
        );
        if (validNodeIds.length > 0 || validEdgeIds.length > 0) {
          safeSetSelection(
            { nodes: validNodeIds, edges: validEdgeIds },
            { highlightEdges: false },
          );
        }
      } else {
        // Only create new instance if it doesn't exist
        networkInstance.current = new Network(
          networkRef.current,
          { nodes, edges },
          networkOptions
        );

        // Helper to change physics while preserving view position
        const setPhysicsPreservingView = (physicsOptions: any) => {
          if (!networkInstance.current) {
            return;
          }
          const scale = networkInstance.current.getScale();
          const position = networkInstance.current.getViewPosition();
          networkInstance.current.setOptions({ physics: physicsOptions });
          networkInstance.current.moveTo({ position, scale, animation: false });
        };

        networkInstance.current.on('click', (event) => {
          // CHAT graph: left-click PINS the element (toggle) — selection is driven by the table
          // checkboxes, Select all, and the card's "Selected" toggle. SETTINGS graph: left-click
          // SELECTS into the operation-set (its detail panel is selection-driven, with no pin-driven
          // card). Empty-space click toggles freeze in both. Read isInChatContextRef so the once-
          // registered handler always sees the live context.
          const restoreSelectionRings = () => {
            safeSetSelection(
              { nodes: [...selectedNodeIdsRef.current], edges: [...selectedEdgeIdsRef.current] },
              { highlightEdges: false },
            );
          };

          if (event.nodes.length > 0) {
            const nodeId = event.nodes[0];
            if (isInChatContextRef.current) {
              // PIN: vis-network auto-selects the clicked node, so re-assert the real selection rings
              // afterward so the pinned element doesn't appear selected.
              const node = graphDataRef.current.nodes.find(n => n.id === nodeId);
              if (node) {
                setRightPaneCollapsed(false);
                setPinnedElement(prev => (prev?.kind === 'node' && prev.data.id === nodeId ? null : { kind: 'node', data: node }));
              }
              restoreSelectionRings();
            } else {
              // SELECT: toggle node in/out of the multi-selection.
              const wasAlreadySelected = selectedNodeIdsRef.current.has(nodeId);
              if (wasAlreadySelected) {
                setSelectedNodes(prev => {
                  const next = prev.filter(n => n.id !== nodeId);
                  safeSetSelection(
                    { nodes: next.map(n => n.id), edges: [...selectedEdgeIdsRef.current] },
                    { highlightEdges: false },
                  );
                  if (next.length === 0 && selectedEdgeIdsRef.current.size === 0 && !isGraphFrozenRef.current) {
                    setPhysicsPreservingView(getSubtlePhysicsWithSpacing());
                  }
                  return next;
                });
              } else {
                setRightPaneCollapsed(false);
                const node = graphDataRef.current.nodes.find(n => n.id === nodeId);
                if (node) {
                  setSelectedNodes(prev => {
                    const next = [...prev, node];
                    safeSetSelection(
                      { nodes: next.map(n => n.id), edges: [...selectedEdgeIdsRef.current] },
                      { highlightEdges: false },
                    );
                    return next;
                  });
                  setPhysicsPreservingView({ enabled: false });
                }
              }
            }
          } else if (event.edges.length > 0) {
            const edgeId = event.edges[0];
            if (isInChatContextRef.current) {
              const edge = graphDataRef.current.edges.find(e => getEdgeKey(e) === edgeId);
              if (edge) {
                setRightPaneCollapsed(false);
                setPinnedElement(prev => (prev?.kind === 'edge' && getEdgeKey(prev.data) === edgeId ? null : { kind: 'edge', data: edge }));
              }
              restoreSelectionRings();
            } else {
              const wasAlreadySelected = selectedEdgeIdsRef.current.has(edgeId);
              if (wasAlreadySelected) {
                setSelectedEdges(prev => {
                  const next = prev.filter(e => getEdgeKey(e) !== edgeId);
                  safeSetSelection(
                    { nodes: [...selectedNodeIdsRef.current], edges: next.map(e => getEdgeKey(e)) },
                    { highlightEdges: false },
                  );
                  if (next.length === 0 && selectedNodeIdsRef.current.size === 0 && !isGraphFrozenRef.current) {
                    setPhysicsPreservingView(getSubtlePhysicsWithSpacing());
                  }
                  return next;
                });
              } else {
                const edge = graphDataRef.current.edges.find(e => getEdgeKey(e) === edgeId);
                if (edge) {
                  setSelectedEdges(prev => {
                    const next = [...prev, edge];
                    safeSetSelection(
                      { nodes: [...selectedNodeIdsRef.current], edges: next.map(e => getEdgeKey(e)) },
                      { highlightEdges: false },
                    );
                    return next;
                  });
                  setPhysicsPreservingView({ enabled: false });
                }
              }
            }
          } else {
            // Clicked on empty space — restore our selection (vis-network auto-deselects)
            // and toggle freeze state. Deselect only via the Deselect All button.
            if (selectedNodeIdsRef.current.size > 0 || selectedEdgeIdsRef.current.size > 0) {
              restoreSelectionRings();
            }
            const newFrozenState = !isGraphFrozenRef.current;
            setIsGraphFrozen(newFrozenState);
            if (newFrozenState) {
              setPhysicsPreservingView({ enabled: false });
            } else {
              setPhysicsPreservingView(getSubtlePhysicsWithSpacing());
            }
          }
        });

        // Mark the pinned element with a broad, soft GRAY halo drawn BEHIND the graph (beforeDrawing),
        // Neo4j-style — a disc behind a node, a casing along an edge. Distinct from the red selection
        // ring and the blue hover glow, and shows regardless of selection. Follows pan/zoom/drag.
        networkInstance.current.on('beforeDrawing', (ctx: any) => {
          const net = networkInstance.current;
          if (!net) {return;}
          const nodeId = pinnedNodeIdRef.current;
          if (nodeId != null) {
            const pos = net.getPositions([nodeId])[nodeId];
            const pinnedNode = graphDataRef.current.nodes.find(n => n.id === nodeId) as (GraphNode & { size?: number }) | undefined;
            if (pos) {
              // Flat gray disc with a crisp edge behind the node — radius tracks the node's own size
              // (entities scale 12-40 by mentionCount) plus a fixed ring margin, so it fits big and
              // small nodes alike instead of being a fixed blob.
              const baseRadius = typeof pinnedNode?.size === 'number' ? pinnedNode.size : 20;
              ctx.save();
              ctx.fillStyle = 'rgba(228, 233, 245, 0.4)';
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, baseRadius + 11, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }
          const edgeKey = pinnedEdgeKeyRef.current;
          if (edgeKey != null) {
            const edge = graphDataRef.current.edges.find((e: any) => getEdgeKey(e) === edgeKey);
            if (edge) {
              const p = net.getPositions([edge.from, edge.to]);
              const a = p[edge.from];
              const b = p[edge.to];
              if (a && b) {
                ctx.save();
                ctx.strokeStyle = 'rgba(220, 225, 235, 0.30)';
                ctx.lineWidth = 12;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.restore();
              }
            }
          }
        });

        // Inspect channel — hover sets the transient hovered element, which the right detail
        // pane shows (overriding the selected element). These never touch the selection set.
        // Read graphDataRef.current to avoid a stale closure (handlers register once). Edge
        // ids in the DataSet equal getEdgeKey(edge). blur clears the hover, so the pane reverts
        // to the selected element.
        networkInstance.current.on('hoverNode', (e: any) => {
          const node = graphDataRef.current.nodes.find(n => n.id === e.node);
          if (node) {setHoveredElement({ kind: 'node', data: node });}
        });
        networkInstance.current.on('blurNode', () => setHoveredElement(null));
        networkInstance.current.on('hoverEdge', (e: any) => {
          const edge = graphDataRef.current.edges.find(ed => getEdgeKey(ed) === e.edge);
          if (edge) {setHoveredElement({ kind: 'edge', data: edge });}
        });
        networkInstance.current.on('blurEdge', () => setHoveredElement(null));

        // Drag is pure motion — it never changes selection. vis-network's
        // onDragStart populates an internal drag.selection cache from whatever
        // is selected at the time we return from this user-level handler
        // (vis-network 10.x InteractionHandler: drag.selection is filled from
        // getSelectedNodes() right after the dragStart event is emitted). To
        // prevent other selected nodes from being dragged in unison with the
        // picked node, we narrow vis-network's selection to JUST the dragged
        // node here. The actual dragged node is at interactionHandler.drag.nodeId
        // — event.nodes is the current selection, which on a drag of an
        // already-selected node would be the entire prior selection.
        networkInstance.current.on('dragStart', () => {
          if (!networkInstance.current) {return;}
          const internal = (networkInstance.current as any).interactionHandler;
          const draggedId = internal?.drag?.nodeId;
          if (typeof draggedId !== 'number') {return;}
          isDraggingNodeRef.current = {
            nodeId: draggedId,
            wasSelected: selectedNodeIdsRef.current.has(draggedId),
          };
          safeSetSelection(
            { nodes: [draggedId], edges: [] },
            { highlightEdges: false },
          );
        });

        // On drag release, clear the drag-tracking ref and restore vis-network's
        // selection to React state (which never changed during the drag). If the
        // dragged node wasn't already selected, this drops it from the visible
        // selection so it stops appearing red.
        networkInstance.current.on('dragEnd', () => {
          if (!networkInstance.current) {return;}
          isDraggingNodeRef.current = null;
          safeSetSelection(
            { nodes: [...selectedNodeIdsRef.current], edges: [...selectedEdgeIdsRef.current] },
            { highlightEdges: false },
          );
          setPhysicsPreservingView({ enabled: false });
        });

        // Only fit on initial creation
        networkInstance.current.once('stabilizationIterationsDone', () => {
          if (networkInstance.current) {
            fitGraph();
            // Switch to subtle floating physics after stabilization
            networkInstance.current.setOptions({ physics: getSubtlePhysicsWithSpacing() });

            // Re-select nodes and edges if any were selected (restore selection after network recreation)
            if (selectedNodeIdsRef.current.size > 0 || selectedEdgeIdsRef.current.size > 0) {
              const currentIds = new Set((networkInstance.current as any).body.data.nodes.getIds());
              const validNodes = [...selectedNodeIdsRef.current].filter(id => currentIds.has(id));
              if (validNodes.length > 0 || selectedEdgeIdsRef.current.size > 0) {
                safeSetSelection(
                  { nodes: validNodes, edges: [...selectedEdgeIdsRef.current] },
                  { highlightEdges: false },
                );
              }
              networkInstance.current.setOptions({ physics: { enabled: false } });
            }
          }
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, hideChunks, isolatedNodeIds, isolatedEdge, expandedNodes, visibleGraphNodes]);

  const availableLabels = overview?.nodeTypes?.map(nt => nt.labels).flat() || [];
  // Filter out PREVIOUS since it's redundant with NEXT (same relationship, opposite direction)
  const availableRelationships = overview?.relationshipTypes?.map(rt => rt.type).filter(t => t !== 'PREVIOUS') || [];

  // Check if graph is empty (no nodes in overview)
  const isGraphEmpty = !overview?.nodeTypes || overview.nodeTypes.length === 0 || 
    overview.nodeTypes.reduce((sum, type) => sum + type.count, 0) === 0;

  // Chat context rendering - simplified interface for chat
  if (isInChatContext) {
    if (!documentIds || documentIds.length === 0) {
      return (
        <Stack
          spacing={0}
          w='50%'
          h='100%'
          bg='dark.4'
        >
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text size='sm' color='gray.5' ta='center'>
              Select sources to view the knowledge graph
            </Text>
          </Box>
        </Stack>
      );
    }

    return (
      <Stack
        ref={splitContainerRef}
        spacing={0}
        w='50%'
        h='100%'
        bg='dark.4'
      >
        {/* Graph View section header */}
        <Group
          px='md'
          py={6}
          position='apart'
          bg='dark.5'
          onClick={() => setGraphCollapsed(!graphCollapsed)}
          sx={{ cursor: 'pointer', flexShrink: 0, '&:hover': { backgroundColor: 'var(--mantine-color-dark-4)' } }}
        >
          <Group spacing='xs'>
            <IconChevronDown size={14} color='gray' style={{ transform: graphCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 150ms' }} />
            <Text size='xs' fw={600} color='gray.2'>Graph View</Text>
            {!graphCollapsed && !(!usePreloadedGraphData && (isInChatContext ? chatNetworkQuery.isLoading : graphQuery.isPending)) && graphData.nodes.length > 0 && (
              <Group spacing='xs'>
                <Badge variant='light' size='xs' color='gray'>
                  {graphData.nodes.length} nodes
                </Badge>
                <Badge variant='light' size='xs' color='gray'>
                  {graphData.edges.length} edges
                </Badge>
                {(() => {
                  const entityCount = graphData.nodes.filter(n => n.labels?.includes('Entity')).length;
                  const conceptCount = graphData.nodes.filter(n => n.labels?.includes('Concept')).length;
                  const chunkCount = graphData.nodes.filter(n => n.labels?.includes('Chunk')).length;
                  return (
                    <>
                      {entityCount > 0 && (
                        <Badge variant='light' size='xs' sx={{ backgroundColor: 'rgba(150, 206, 180, 0.2)', color: '#96CEB4' }}>
                          {entityCount} entities
                        </Badge>
                      )}
                      {conceptCount > 0 && (
                        <Badge variant='light' size='xs' sx={{ backgroundColor: 'rgba(69, 183, 209, 0.2)', color: '#45B7D1' }}>
                          {conceptCount} concepts
                        </Badge>
                      )}
                      {chunkCount > 0 && (
                        <Badge variant='light' size='xs' sx={{ backgroundColor: 'rgba(221, 160, 221, 0.2)', color: '#DDA0DD' }}>
                          {chunkCount} chunks
                        </Badge>
                      )}
                    </>
                  );
                })()}
              </Group>
            )}
          </Group>
        </Group>

        {/* Graph content — kept mounted (display:none on collapse) so vis-network's canvas survives across toggles. Unmounting would orphan networkInstance.current on a dead DOM and the graph would render blank when re-opened. */}
        <Box sx={{
          display: graphCollapsed ? 'none' : 'block',
          flex: (tableCollapsed || !enumerationData) ? 1 : undefined,
          height: (!tableCollapsed && enumerationData) ? `${graphSplitPercent}%` : undefined,
          overflow: 'hidden',
        }}>
          <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
              {/* Always mount networkRef so vis-network can render when graphData arrives */}
              <Box
                ref={networkRef}
                style={{
                  height: enumerationData ? '100vh' : '100%',
                  width: '100%',
                  background: theme.colors.dark[6],
                }}
              />

              {/* Overlay states on top of the canvas */}
              {(!usePreloadedGraphData && (isInChatContext ? chatNetworkQuery.isLoading : graphQuery.isPending)) ? (
                <Box style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: '1rem',
                  background: theme.colors.dark[6],
                }}>
                  <Loader size='md' />
                  <Text size='sm' color='gray.5'>Loading knowledge graph...</Text>
                </Box>
              ) : (!usePreloadedGraphData && (isInChatContext ? chatNetworkQuery.error : graphQuery.error)) ? (
                <Box style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '2rem',
                  background: theme.colors.dark[6],
                }}>
                  <Text size='sm' color='gray.5' ta='center'>
                    Failed to load knowledge graph
                  </Text>
                </Box>
              ) : graphData.nodes.length === 0 ? (
                <Box style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '2rem',
                  background: theme.colors.dark[6],
                }}>
                  <Text size='sm' color='gray.5' ta='center'>
                    {enumerationData
                      ? 'Filter and select values from the table below to add to the graph'
                      : 'No graph data available for selected sources'}
                  </Text>
                  {/* Keep Reset in its usual bottom-left spot even when the graph is empty, so it
                      doesn't move and the user can still restore the post-answer view. */}
                  {onResetGraph && resetGraphControl}
                </Box>
              ) : (
                <>

              {/* Document legend and controls - top left corner */}
              <Stack
                spacing={8}
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  padding: '8px',
                  zIndex: 5,
                  pointerEvents: 'auto',
                }}
              >
                {/* Node spacing slider */}
                <Box sx={{ width: 150 }}>
                  <Text size='xs' color='gray.5' mb={4}>
                    Node Spacing
                  </Text>
                  <Slider
                    value={nodeSpacing}
                    onChange={handleNodeSpacingChange}
                    min={50}
                    max={500}
                    step={10}
                    size='xs'
                    color='gray'
                    styles={{
                      track: { backgroundColor: theme.colors.dark[4] },
                      bar: { backgroundColor: theme.colors.gray[6] },
                      thumb: { backgroundColor: theme.colors.gray[4], borderColor: theme.colors.gray[6] },
                    }}
                  />
                </Box>

                {/* Isolation status is shown by the Isolate icon's active state in the toolbar (see Paper below). */}

              </Stack>

              {/* Reset button - bottom left, above the action strip */}
              {resetGraphControl}

              {/* Right detail/selection pane. Detail (node/edge) is driven by paneTarget =
                  hovered element (transient) ?? single selection, so hover swaps the pane and
                  reverts on mouse-out (Neo4j-style). With ≥2 selected and nothing hovered, the
                  pane shows the multi-select summary. Operations live in the toolbar below. */}

              {(paneTarget || totalSelected >= 2) && rightPaneCollapsed && (
                <Tooltip label='Show details' position='left'>
                  <ActionIcon
                    variant='filled'
                    color='dark.5'
                    size='md'
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 5,
                    }}
                    onClick={() => setRightPaneCollapsed(false)}
                  >
                    <IconChevronLeft size={14} />
                  </ActionIcon>
                </Tooltip>
              )}

              {paneTarget && !rightPaneCollapsed && (
                <GraphElementDetail
                  kind={paneTarget.kind}
                  node={paneTarget.kind === 'node' ? paneTarget.data : undefined}
                  edge={paneTarget.kind === 'edge' ? paneTarget.data : undefined}
                  graphNodes={graphData.nodes}
                  documentInfo={paneDocumentInfo}
                  onViewSource={() => handleViewSource(paneTarget)}
                  onCollapse={() => setRightPaneCollapsed(true)}
                  pinned={paneTargetIsPinned}
                  onTogglePin={handleTogglePin}
                  selected={paneTargetIsSelected}
                  onToggleSelected={handleToggleSelected}
                />
              )}

              {!paneTarget && totalSelected >= 2 && !rightPaneCollapsed && (
                <Stack
                  spacing={0}
                  w={200}
                  bg='dark.6'
                  style={{
                    borderLeft: '1px solid #2C2E33',
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    height: '100%',
                  }}
                >
                  <Group position='apart' p='sm' bg='dark.5'>
                    <Text size='xs' fw={500} color='gray.3'>
                      {selectedNodes.length > 0 && `${selectedNodes.length} node${selectedNodes.length > 1 ? 's' : ''}`}
                      {selectedNodes.length > 0 && selectedEdges.length > 0 && ', '}
                      {selectedEdges.length > 0 && `${selectedEdges.length} edge${selectedEdges.length > 1 ? 's' : ''}`}
                    </Text>
                    <ActionIcon
                      size='xs'
                      variant='subtle'
                      onClick={() => setRightPaneCollapsed(true)}
                    >
                      <IconChevronRight size={12} />
                    </ActionIcon>
                  </Group>

                  <ScrollArea h='100%' p='sm'>
                    <Stack spacing={8}>
                      {/* Group nodes and edges by document */}
                      {(() => {
                        const docGroups = new Map<string, { name: string; color: string; nodes: typeof selectedNodes; edges: typeof selectedEdges }>();

                        const resolveDocGroup = (docId: string) => {
                          if (!docGroups.has(docId)) {
                            const color = documentColorMapRef.current?.get(docId) || '#666';
                            const name = documentNameMap[docId]
                              || documentNameMapRef.current?.get(docId)
                              || documentLegend.find(l => l.color === color)?.name
                              || `Doc ${docId.substring(0, 8)}...`;
                            docGroups.set(docId, { name, color, nodes: [], edges: [] });
                          }
                          return docGroups.get(docId)!;
                        };

                        for (const node of selectedNodes) {
                          const docId = node.properties?.documentId;
                          if (docId) {
                            resolveDocGroup(docId).nodes.push(node);
                          }
                        }

                        for (const edge of selectedEdges) {
                          const edgeDocId = edge.properties?.documentId
                            || graphData.nodes.find(n => n.id === edge.from)?.properties?.documentId
                            || graphData.nodes.find(n => n.id === edge.to)?.properties?.documentId;
                          if (edgeDocId) {
                            resolveDocGroup(edgeDocId).edges.push(edge);
                          }
                        }

                        return [...docGroups.entries()].map(([docId, group]) => (
                          <Box key={docId}>
                            <Group spacing={6} noWrap mb={4}>
                              <Box sx={{ width: 10, height: 10, backgroundColor: group.color, border: `2px solid ${documentLegend.find(l => l.color === group.color)?.borderColor || group.color}`, flexShrink: 0 }} />
                              <Text size={10} fw={700} color='gray.4' tt='uppercase' lineClamp={1}>{group.name}</Text>
                            </Group>
                            <Stack spacing={2} ml={14}>
                              {group.nodes.map((node) => (
                                <Tooltip key={`node-${node.id}`} label={node.label} position='left' openDelay={300} withinPortal>
                                  <Box sx={{ cursor: 'default' }}>
                                    <Group spacing='xs' noWrap>
                                      <Badge size='xs' variant='filled' sx={{
                                        backgroundColor: node.labels?.[0] === 'Entity' ? '#96CEB4' :
                                          node.labels?.[0] === 'Concept' ? '#45B7D1' :
                                          node.labels?.[0] === 'Chunk' ? '#DDA0DD' :
                                          node.labels?.[0] === 'Document' ? '#E8A87C' : undefined,
                                        color: '#1A1B1E',
                                        flexShrink: 0,
                                      }}>
                                        {node.labels?.[0] || 'Node'}
                                      </Badge>
                                      <Text size='xs' color='gray.4' lineClamp={1}>{node.label}</Text>
                                    </Group>
                                  </Box>
                                </Tooltip>
                              ))}
                              {group.edges.map((edge) => (
                                <Group key={`edge-${getEdgeKey(edge)}`} spacing='xs' noWrap>
                                  <Badge size='xs' variant='filled' sx={{ backgroundColor: '#555', color: '#ddd', flexShrink: 0 }}>
                                    Edge
                                  </Badge>
                                  <Text size='xs' color='gray.4' lineClamp={1}>{edge.type}</Text>
                                </Group>
                              ))}
                            </Stack>
                          </Box>
                        ));
                      })()}
                    </Stack>
                  </ScrollArea>
                </Stack>
              )}

              {/* Floating action toolbar — single horizontal row of icons. Labels via tooltip.
                  Sits below the top-left Node Spacing slider. */}
              <Paper
                p={6}
                radius='sm'
                sx={{
                  position: 'absolute',
                  top: 48,
                  left: 8,
                  zIndex: 10,
                  backgroundColor: 'rgba(0, 0, 0, 0.55)',
                  backdropFilter: 'blur(2px)',
                  // Make disabled icons unmistakably "off" — strip color and dim hard,
                  // otherwise dark-on-dark themes leave disabled and active states
                  // looking near-identical.
                  '& [data-disabled]': {
                    filter: 'grayscale(1)',
                    opacity: 0.35,
                    cursor: 'not-allowed',
                  },
                }}
              >
                <Group spacing={4} noWrap>
                  {/* Hide / Show Chunks */}
                  <Tooltip label={hideChunks ? 'Show chunks' : 'Hide chunks'} position='bottom' withArrow>
                    <Box sx={{ display: 'inline-flex' }}>
                      <ActionIcon
                        size='md'
                        variant={hideChunks ? 'filled' : 'outline'}
                        color='gray'
                        onClick={() => setHideChunks(!hideChunks)}
                      >
                        {hideChunks ? <IconEye size={16} /> : <IconEyeOff size={16} />}
                      </ActionIcon>
                    </Box>
                  </Tooltip>

                  {/* Select All */}
                  {(() => {
                    const allSelected = graphData.nodes.length > 0
                      && selectedNodes.length === graphData.nodes.length
                      && selectedEdges.length === graphData.edges.length;
                    return (
                      <Tooltip label='Select all' position='bottom' withArrow>
                        <Box sx={{ display: 'inline-flex' }}>
                          <ActionIcon
                            size='md'
                            variant='outline'
                            color='red'
                            disabled={graphData.nodes.length === 0 || allSelected}
                            onClick={() => {
                              setSelectedNodes(graphData.nodes);
                              setSelectedEdges(graphData.edges);
                              const edgeIds = graphData.edges.map(e => getEdgeKey(e));
                              safeSetSelection({
                                nodes: graphData.nodes.map(n => n.id),
                                edges: edgeIds,
                              }, { highlightEdges: false });
                            }}
                          >
                            <IconSelectAll size={16} />
                          </ActionIcon>
                        </Box>
                      </Tooltip>
                    );
                  })()}

                  {/* Deselect All */}
                  <Tooltip label='Deselect all' position='bottom' withArrow>
                    <Box sx={{ display: 'inline-flex' }}>
                      <ActionIcon
                        size='md'
                        variant='outline'
                        color='red'
                        disabled={totalSelected === 0}
                        onClick={() => {
                          setSelectedNodes([]);
                          setSelectedEdges([]);
                          networkInstance.current?.unselectAll();
                        }}
                      >
                        <IconDeselect size={16} />
                      </ActionIcon>
                    </Box>
                  </Tooltip>

                  <Divider orientation='vertical' color='dark.4' mx={4} />
                    {/* Expand */}
                    {(() => {
                      const noSelection = selectedNodes.length === 0;
                      const allExpanded = !noSelection && selectedNodes.every(n => expandedNodes.has(n.id) || fullyExpandedNodes.has(n.id));
                      const tooMany = selectedNodes.length > 10;
                      const singleFullyExpanded = !!selectedNode && fullyExpandedNodes.has(selectedNode.id);
                      const isDisabled = noSelection || tooMany || allExpanded || singleFullyExpanded || (!!selectedNode && isCheckingExpandability);
                      const tip = noSelection ? 'Expand — select a node first'
                        : tooMany ? 'Expand — pick 10 or fewer'
                        : allExpanded ? 'Already expanded'
                        : 'Expand';
                      return (
                        <Tooltip label={tip} position='bottom' withArrow>
                          <Box sx={{ display: 'inline-flex' }}>
                          <ActionIcon
                            size='md'
                            variant='filled'
                            color='blue'
                            loading={isExpandingNode || (selectedNode ? isCheckingExpandability : false)}
                            disabled={isDisabled}
                            onClick={selectedNode
                              ? () => handleNodeExpand(selectedNode.id)
                              : async () => {
                                  const nodesToExpand = selectedNodes.filter(n => !expandedNodes.has(n.id) && !fullyExpandedNodes.has(n.id));
                                  for (const node of nodesToExpand) {
                                    await handleNodeExpand(node.id, true);
                                  }
                                  if (nodesToExpand.length > 0) {
                                    safeSetSelection({ nodes: selectedNodes.map(n => n.id) }, { highlightEdges: false });
                                    setTimeout(() => {
                                      if (networkInstance.current) {
                                        networkInstance.current.setOptions({ physics: fullPhysics });
                                        networkInstance.current.once('stabilizationIterationsDone', () => {
                                          if (networkInstance.current) {
                                            networkInstance.current.setOptions({ physics: { enabled: false } });
                                          }
                                        });
                                        setTimeout(() => {
                                          if (networkInstance.current) {
                                            networkInstance.current.setOptions({ physics: { enabled: false } });
                                          }
                                        }, 1500);
                                      }
                                    }, 100);
                                  }
                                }
                            }
                          >
                            <IconArrowsMaximize size={16} />
                          </ActionIcon>
                          </Box>
                        </Tooltip>
                      );
                    })()}

                    {/* Collapse */}
                    <Tooltip label='Collapse' position='bottom' withArrow>
                      <Box sx={{ display: 'inline-flex' }}>
                        <ActionIcon
                          size='md'
                          variant='outline'
                          color='cyan'
                          disabled={!selectedNodes.some(n => expandedNodes.has(n.id))}
                          onClick={selectedNode
                            ? () => handleNodeCollapse(selectedNode.id)
                            : () => {
                                for (const node of selectedNodes.filter(n => expandedNodes.has(n.id))) {
                                  handleNodeCollapse(node.id);
                                }
                              }
                          }
                        >
                          <IconArrowsDiagonalMinimize2 size={16} />
                        </ActionIcon>
                      </Box>
                    </Tooltip>

                    {/* Isolate — stateful toggle. When isolation is active, the icon
                        is filled cyan with a count badge; clicking clears isolation.
                        When inactive, click starts isolation on the current selection. */}
                    {(() => {
                      const isolationActive = isolatedNodeIds.length > 0 || isolatedEdge !== null;
                      const count = isolatedEdge !== null ? 1 : isolatedNodeIds.length;
                      // Toggle: when isolation is active, click clears (always enabled).
                      // When inactive, disabled only if nothing is selected to isolate.
                      const isDisabled = !isolationActive && selectedNodes.length === 0 && !selectedEdge;
                      const tip = isolationActive
                        ? `Clear isolation (${count} ${count === 1 ? (isolatedEdge ? 'edge' : 'node') : 'nodes'})`
                        : 'Isolate';
                      const button = (
                        <Box sx={{ display: 'inline-flex' }}>
                          <ActionIcon
                            size='md'
                            variant={isolationActive ? 'filled' : 'outline'}
                            color='cyan'
                            disabled={isDisabled}
                            onClick={() => {
                              if (isolationActive) {
                                setIsolatedNodeIds([]);
                                setIsolatedEdge(null);
                                return;
                              }
                              if (selectedNodes.length > 0) {
                                handleIsolate(selectedNodes.map(n => n.id));
                              } else if (selectedEdge) {
                                setIsolatedNodeIds([]);
                                setExpandedNodes(new Map());
                                setFullyExpandedNodes(new Set());
                                setIsolatedEdge({ from: selectedEdge.from, to: selectedEdge.to });
                              }
                            }}
                          >
                            <IconFocus2 size={16} />
                          </ActionIcon>
                        </Box>
                      );
                      return (
                        <Tooltip label={tip} position='bottom' withArrow>
                          {isolationActive ? (
                            <Indicator label={count} size={14} color='cyan' offset={2} withBorder>
                              {button}
                            </Indicator>
                          ) : button}
                        </Tooltip>
                      );
                    })()}

                    {/* Connect */}
                    {(() => {
                      const tooFew = selectedNodes.length < 2;
                      const tooMany = selectedNodes.length > 20;
                      const tip = tooFew ? 'Connect — pick 2+ nodes'
                        : tooMany ? 'Connect — pick 20 or fewer'
                        : 'Connect';
                      return (
                        <Tooltip label={tip} position='bottom' withArrow>
                          <Box sx={{ display: 'inline-flex' }}>
                            <ActionIcon
                              size='md'
                              variant='filled'
                              color='teal'
                              loading={isConnecting}
                              disabled={tooFew || tooMany}
                              onClick={handleConnectNodes}
                            >
                              <IconRoute size={16} />
                            </ActionIcon>
                          </Box>
                        </Tooltip>
                      );
                    })()}

                    {/* Remove */}
                    <Tooltip label='Remove' position='bottom' withArrow>
                      <Box sx={{ display: 'inline-flex' }}>
                        <ActionIcon
                          size='md'
                          variant='outline'
                          color='red'
                          disabled={totalSelected === 0}
                          onClick={handleRemoveSelected}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Box>
                    </Tooltip>
                </Group>
              </Paper>

              </>
              )}
            </Box>
        </Box>

        {/* Drag handle — only when both sections expanded */}
        {!graphCollapsed && !tableCollapsed && enumerationData && onEntitySelectionChange && (
          <Box
            onMouseDown={handleSplitMouseDown}
            sx={(theme) => ({
              height: 6,
              flexShrink: 0,
              cursor: 'row-resize',
              backgroundColor: theme.colors.dark[5],
              transition: 'background-color 120ms',
              '&:hover': { backgroundColor: theme.colors.cyan[7] },
            })}
          />
        )}

        {/* Table View section — show when data exists OR when tabs exist (deselected state) */}
        {(enumerationData || (enumerationTabs && enumerationTabs.length > 0)) && onEntitySelectionChange && (
          <>
            <Group
              px='md'
              py={6}
              position='apart'
              bg='dark.5'
              onClick={() => setTableCollapsed(!tableCollapsed)}
              sx={{ cursor: 'pointer', flexShrink: 0, '&:hover': { backgroundColor: 'var(--mantine-color-dark-4)' } }}
            >
              <Group spacing='xs'>
                <IconChevronDown size={14} color='gray' style={{ transform: tableCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 150ms' }} />
                <Text size='xs' fw={600} color='gray.2'>{evidenceMode ? 'Answer Evidence' : 'Table View'}</Text>
                {enumerationData && (
                  <Text size='xs' color='dimmed'>
                    ({enumerationData.rowCount} {evidenceMode ? (enumerationData.rowCount === 1 ? 'node' : 'nodes') : 'results'})
                  </Text>
                )}
                {!enumerationData && (
                  <Text size='xs' color='dimmed'>(no tab selected)</Text>
                )}
              </Group>
            </Group>

            {evidenceMode ? (
              /* Subgraph Inspector — one subgraph, two symmetric panels (Nodes | Relationships).
                 Selecting/filtering in either panel drives the canvas. */
              !tableCollapsed && enumerationData && (
                <Box sx={{ flex: graphCollapsed ? 1 : undefined, height: !graphCollapsed ? `${100 - graphSplitPercent}%` : undefined, overflow: 'hidden' }}>
                  <SubgraphInspector
                    data={enumerationData}
                    selectedNodeUuids={selectedEntityIds || []}
                    selectedEdgeKeys={selectedEdgeKeys}
                    onNodeSelectionChange={onEntitySelectionChange}
                    onEdgeSelectionChange={setSelectedEdgeKeys}
                    onSelectNodesOnGraph={handleSelectEntitiesOnGraph}
                    onSelectEdgesOnGraph={handleSelectEdgesOnGraph}
                    opSelectedNodeUuids={opSelectedEntityIds}
                    opSelectedEdgeKeys={opSelectedEdgeKeys}
                  />
                </Box>
              )
            ) : (
              <>
                {/* Tab bar — show whenever tabs exist so user can deselect for unscoped queries */}
                {!tableCollapsed && enumerationTabs && enumerationTabs.length > 0 && (
                  <EnumerationTabBar
                    tabs={enumerationTabs}
                    activeTabId={activeTabId ?? null}
                    onTabChange={onTabChange}
                    onTabClose={onTabClose}
                  />
                )}

                {!tableCollapsed && !enumerationData && (
                  <Text size='xs' color='gray.5' fs='italic' ta='center' py='md'>
                    Select a tab to scope your next query to those results. With no tab selected, queries run against the full graph.
                  </Text>
                )}

                {!tableCollapsed && enumerationData && (
                  <Box sx={{ flex: graphCollapsed ? 1 : undefined, height: !graphCollapsed ? `${100 - graphSplitPercent}%` : undefined, overflow: 'hidden' }}>
                    <GraphSearchTable
                      data={enumerationData}
                      selectedEntityIds={selectedEntityIds || []}
                      onSelectionChange={onEntitySelectionChange}
                      onSelectOnGraph={handleSelectEntitiesOnGraph}
                      opSelectedEntityIds={opSelectedEntityIds}
                    />
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </Stack>
    );
  }

  // Settings page rendering - full interface
  return (
    <Stack spacing='md'>
      <Paper p='md' withBorder>
        <Title order={3} mb='md'>
          Graph Database
        </Title>
        
        {isGraphEmpty ? (
          <Text c='dimmed' ta='center' py='xl'>
            The graph database is currently empty.
          </Text>
        ) : (
          overview && (
            <>
              {overview.nodeTypes && overview.nodeTypes.length > 0 && (
                <Stack spacing='sm' mb='md'>
                  <Text fw={500} size='sm'>
                    Node Types ({overview.nodeTypes?.length || 0} types, {overview.nodeTypes?.reduce((sum, type) => sum + type.count, 0).toLocaleString() || 0} nodes):
                  </Text>
                  <Group spacing='xs'>
                    {overview.nodeTypes.slice(0, 8).map((type, index) => {
                      // Color-code by node type to match graph visualization
                      const label = type.labels[0] || '';
                      let badgeStyle = {};
                      if (label === 'Entity') {
                        badgeStyle = { backgroundColor: 'rgba(150, 206, 180, 0.2)', color: '#96CEB4' };
                      } else if (label === 'Concept') {
                        badgeStyle = { backgroundColor: 'rgba(69, 183, 209, 0.2)', color: '#45B7D1' };
                      } else if (label === 'Chunk') {
                        badgeStyle = { backgroundColor: 'rgba(221, 160, 221, 0.2)', color: '#DDA0DD' };
                      } else if (label === 'Document') {
                        badgeStyle = { backgroundColor: 'rgba(149, 117, 205, 0.2)', color: '#9575CD' };
                      }
                      return (
                        <Badge key={index} variant='light' size='sm' sx={badgeStyle}>
                          {type.labels.join(', ')} ({type.count.toLocaleString()})
                        </Badge>
                      );
                    })}
                    {overview.nodeTypes.length > 8 && (
                      <Badge variant='outline' size='sm'>
                        +{overview.nodeTypes.length - 8} more
                      </Badge>
                    )}
                  </Group>
                </Stack>
              )}

              {overview.relationshipTypes && overview.relationshipTypes.length > 0 && (
                <Stack spacing='sm'>
                  <Text fw={500} size='sm'>
                    Relationship Types ({overview.relationshipTypes?.length || 0} types, {overview.relationshipTypes?.reduce((sum, type) => sum + type.count, 0).toLocaleString() || 0} relationships):
                  </Text>
                  <Group spacing='xs'>
                    {overview.relationshipTypes.slice(0, 8).map((type, index) => (
                      <Badge key={index} variant='light' size='sm' color='gray'>
                        {type.type} ({type.count.toLocaleString()})
                      </Badge>
                    ))}
                    {overview.relationshipTypes.length > 8 && (
                      <Badge variant='outline' size='sm'>
                        +{overview.relationshipTypes.length - 8} more
                      </Badge>
                    )}
                  </Group>
                </Stack>
              )}
            </>
          )
        )}
      </Paper>

      {!isGraphEmpty && (
        <Stack spacing='md'>
          <Paper p='md' withBorder>
          <Title order={4} mb='md'>Filters & Options</Title>
          <Grid>
            <Grid.Col span={3}>
              <NumberInput
                label='Limit'
                value={limit}
                onChange={(value) => setLimit(value || GraphNodeLimits.DEFAULT)}
                min={GraphNodeLimits.MIN}
                max={GraphNodeLimits.MAX}
                step={10}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <MultiSelect
                label='Node Labels'
                placeholder='Select labels...'
                data={[
                  { value: '__ALL__', label: 'All' },
                  ...availableLabels.map(label => ({
                    value: label,
                    label,
                    disabled: selectedLabels.includes('__ALL__'),
                  })),
                ]}
                value={selectedLabels}
                onChange={(values) => {
                  // If All was just selected, clear everything else
                  if (values.includes('__ALL__') && !selectedLabels.includes('__ALL__')) {
                    setSelectedLabels(['__ALL__']);
                  } else if (selectedLabels.includes('__ALL__') && values.length > 1) {
                    // If something else was selected while All was active, remove All
                    setSelectedLabels(values.filter(v => v !== '__ALL__'));
                  } else {
                    setSelectedLabels(values);
                  }
                }}
                clearable
                searchable
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <MultiSelect
                label='Relationship Types'
                placeholder='Select relationships...'
                data={[
                  { value: '__ALL__', label: 'All' },
                  ...availableRelationships.map(rel => ({
                    value: rel,
                    label: rel,
                    disabled: selectedRelationships.includes('__ALL__'),
                  })),
                ]}
                value={selectedRelationships}
                onChange={(values) => {
                  // If All was just selected, clear everything else
                  if (values.includes('__ALL__') && !selectedRelationships.includes('__ALL__')) {
                    setSelectedRelationships(['__ALL__']);
                  } else if (selectedRelationships.includes('__ALL__') && values.length > 1) {
                    // If something else was selected while All was active, remove All
                    setSelectedRelationships(values.filter(v => v !== '__ALL__'));
                  } else {
                    setSelectedRelationships(values);
                  }
                }}
                clearable
                searchable
              />
            </Grid.Col>
            <Grid.Col span={1}>
              <Button
                onClick={loadNetwork}
                loading={graphQuery.isPending}
                fullWidth
                mt={24}
              >
                Query
              </Button>
            </Grid.Col>
          </Grid>
          
          <Button
            variant='subtle'
            leftIcon={<IconChevronDown size={16} style={{ transform: showCustomQuery ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
            onClick={() => setShowCustomQuery(!showCustomQuery)}
            mt='md'
            size='sm'
          >
            {showCustomQuery ? 'Hide' : 'Show'} Custom Query
          </Button>
          
          <Collapse in={showCustomQuery}>
            <Grid mt='md'>
              <Grid.Col span={10}>
                <Textarea
                  label='Cypher Query'
                  description={allowWriteQueries
                    ? <Text fz='xs' color='red'>Execute custom Cypher queries against your graph database. Write operations are enabled.</Text>
                    : 'Execute custom Cypher queries against your graph database. Only read operations are allowed for security.'
                  }
                  placeholder='MATCH (n) RETURN n LIMIT 25'
                  value={customQuery}
                  onChange={(event) => setCustomQuery(event.currentTarget.value)}
                  minRows={3}
                  maxRows={6}
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <Button
                  onClick={executeCustomQuery}
                  loading={graphQuery.isPending}
                  leftIcon={<IconSearch size={16} />}
                  fullWidth
                  mt={24}
                >
                  Execute
                </Button>
              </Grid.Col>
            </Grid>
            <Checkbox
              label='Allow write queries (e.g. CREATE, DELETE, SET)'
              checked={allowWriteQueries}
              onChange={(event) => setAllowWriteQueries(event.currentTarget.checked)}
              mt='sm'
            />
          </Collapse>
        </Paper>

        {hasLoadedNetwork && (
          <Paper p='md' withBorder>
            <Group position='apart' mb='md'>
              <Title order={4} data-testid='network-visualization-title'>Network Visualization</Title>
              <Group>
                <Badge variant='light'>
                  Nodes: {graphData.nodes.length}
                </Badge>
                <Badge variant='light'>
                  Edges: {graphData.edges.length}
                </Badge>
              </Group>
            </Group>

            {graphQuery.isPending ? (
              <Box style={{ textAlign: 'center', padding: '100px' }}>
                <Loader size='lg' />
                <Text mt='md'>Loading graph data...</Text>
              </Box>
            ) : (
              <Box sx={{ position: 'relative' }}>
                <Box
                  ref={networkRef}
                  style={{
                    height: '600px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />

                {/* Graph controls - top left corner */}
                <Box
                  sx={(theme) => ({
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    padding: '8px',
                    backgroundColor: theme.colorScheme === 'dark' ? 'rgba(26, 27, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                    borderRadius: theme.radius.sm,
                    minWidth: 150,
                  })}
                >
                  <Text size='xs' c='dimmed' mb={4}>
                    Node Spacing
                  </Text>
                  <Slider
                    value={nodeSpacing}
                    onChange={handleNodeSpacingChange}
                    min={50}
                    max={500}
                    step={10}
                    size='xs'
                  />

                  {/* Isolation status indicator */}
                  {isolatedNodeIds.length > 0 && (
                    <Group
                      spacing={6}
                      mt='sm'
                      sx={{
                        backgroundColor: theme.colors.cyan[9],
                        border: `1px solid ${theme.colors.cyan[6]}`,
                        borderRadius: 4,
                        padding: '4px 8px',
                      }}
                    >
                      <Text size='xs' sx={{ color: theme.colors.cyan[4] }} fw={500} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(() => {
                          if (isolatedNodeIds.length === 1) {
                            const node = graphData.nodes.find(n => n.id === isolatedNodeIds[0]);
                            const nodeType = node?.labels?.[0] || 'Node';
                            const name = node?.label || node?.properties?.name || node?.properties?.title || node?.properties?.filename;
                            if (name) {return `Isolated ${nodeType}: ${name}`;}
                            if (node?.properties?.summary) {return `Isolated ${nodeType}: ${node.properties.summary.slice(0, 20)}...`;}
                            return `Isolated ${nodeType}`;
                          }
                          return `Isolated ${isolatedNodeIds.length} nodes`;
                        })()}
                      </Text>
                      <ActionIcon
                        size='xs'
                        variant='transparent'
                        onClick={() => setIsolatedNodeIds([])}
                        sx={{ color: theme.colors.cyan[4], '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    </Group>
                  )}

                  {/* Edge isolation status indicator */}
                  {isolatedEdge !== null && (
                    <Group
                      spacing={6}
                      mt='sm'
                      sx={{
                        backgroundColor: theme.colors.cyan[9],
                        border: `1px solid ${theme.colors.cyan[6]}`,
                        borderRadius: 4,
                        padding: '4px 8px',
                      }}
                    >
                      <Text size='xs' sx={{ color: theme.colors.cyan[4] }} fw={500} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const fromNode = graphData.nodes.find(n => n.id === isolatedEdge.from);
                          const toNode = graphData.nodes.find(n => n.id === isolatedEdge.to);
                          const fromName = fromNode?.label || fromNode?.properties?.name || 'Node';
                          const toName = toNode?.label || toNode?.properties?.name || 'Node';
                          return `Isolated Edge: ${fromName} → ${toName}`;
                        })()}
                      </Text>
                      <ActionIcon
                        size='xs'
                        variant='transparent'
                        onClick={() => {
                          // Just clear edge isolation filter — graphData stays intact
                          setIsolatedEdge(null);
                        }}
                        sx={{ color: theme.colors.cyan[4], '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    </Group>
                  )}
                </Box>

                {selectedNode && (
                  <Paper
                    p='md'
                    withBorder
                    sx={(theme) => ({
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 300,
                      maxHeight: '600px',
                      overflow: 'auto',
                      backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[7] : theme.white,
                    })}
                  >
                    <Group position='apart' mb='md'>
                      <Title order={4}>Selected Node</Title>
                      <Button
                        variant='subtle'
                        size='xs'
                        onClick={() => setSelectedNodes([])}
                      >
                        Close
                      </Button>
                    </Group>

                    {/* Action buttons */}
                    <Stack spacing='xs' mb='md'>
                      {expandedNodes.has(selectedNode.id) ? (
                        <Button
                          size='xs'
                          variant='outline'
                          loading={isExpandingNode}
                          onClick={() => handleNodeCollapse(selectedNode.id)}
                          fullWidth
                          styles={(theme) => ({
                            root: {
                              backgroundColor: theme.colors.dark[7],
                              borderColor: theme.colors.cyan[6],
                              color: theme.colors.cyan[4],
                              '&:hover': {
                                backgroundColor: theme.colors.cyan[9],
                                borderColor: theme.colors.cyan[5],
                              },
                            },
                          })}
                        >
                          Collapse
                        </Button>
                      ) : (
                        <Button
                          size='xs'
                          variant='filled'
                          color='blue'
                          loading={isExpandingNode}
                          disabled={fullyExpandedNodes.has(selectedNode.id)}
                          onClick={() => handleNodeExpand(selectedNode.id)}
                          fullWidth
                          styles={(theme) => ({
                            root: {
                              '&:disabled': {
                                backgroundColor: theme.colors.dark[6],
                                color: theme.colors.dark[2],
                              },
                            },
                          })}
                        >
                          Expand
                        </Button>
                      )}

                      <Button
                        size='xs'
                        variant='outline'
                        disabled={isolatedNodeIds.length === 1 && isolatedNodeIds[0] === selectedNode.id}
                        onClick={() => handleIsolate([selectedNode.id])}
                        fullWidth
                        styles={(theme) => ({
                          root: {
                            borderColor: theme.colors.cyan[6],
                            color: theme.colors.cyan[4],
                            '&:hover:not(:disabled)': {
                              backgroundColor: theme.colors.cyan[9],
                              borderColor: theme.colors.cyan[5],
                            },
                            '&:disabled': {
                              backgroundColor: theme.colors.dark[6],
                              borderColor: theme.colors.dark[4],
                              color: theme.colors.dark[2],
                            },
                          },
                        })}
                      >
                        Isolate
                      </Button>

                      <Button
                        size='xs'
                        variant='outline'
                        color='red'
                        leftIcon={<IconTrash size={14} />}
                        onClick={handleRemoveSelected}
                        fullWidth
                      >
                        Remove from Graph
                      </Button>
                    </Stack>

                    <Stack spacing='sm'>
                      <Box>
                        <Text fw={500} size='sm' mb={4}>Labels:</Text>
                        <Group spacing='xs'>
                          {selectedNode.labels.map((label, index) => (
                            <Badge key={index} size='sm' variant='light'>
                              {label}
                            </Badge>
                          ))}
                        </Group>
                      </Box>

                      <Box>
                        <Text fw={500} size='sm' mb={4}>ID:</Text>
                        <Text size='sm' c='dimmed'>{selectedNode.id}</Text>
                      </Box>

                      {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                        <Box>
                          <Text fw={500} size='sm' mb={4}>Properties:</Text>
                          <Code block style={{ fontSize: '12px', maxHeight: '300px', overflow: 'auto' }}>
                            {JSON.stringify(selectedNode.properties, null, 2)}
                          </Code>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                )}

                {totalSelected >= 2 && (
                  <Paper
                    p='md'
                    withBorder
                    sx={(theme) => ({
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 300,
                      maxHeight: '600px',
                      overflow: 'auto',
                      backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[7] : theme.white,
                    })}
                  >
                    <Group position='apart' mb='md'>
                      <Title order={4}>
                        {selectedNodes.length > 0 && `${selectedNodes.length} node${selectedNodes.length > 1 ? 's' : ''}`}
                        {selectedNodes.length > 0 && selectedEdges.length > 0 && ', '}
                        {selectedEdges.length > 0 && `${selectedEdges.length} edge${selectedEdges.length > 1 ? 's' : ''}`}
                      </Title>
                      <Button
                        variant='subtle'
                        size='xs'
                        onClick={() => { setSelectedNodes([]); setSelectedEdges([]); }}
                      >
                        Close
                      </Button>
                    </Group>

                    <Stack spacing='xs' mb='md'>
                      {selectedNodes.length >= 1 && (
                        <Button
                          size='xs'
                          variant='filled'
                          color='blue'
                          loading={isExpandingNode}
                          onClick={async () => {
                            for (const node of selectedNodes) {
                              if (!expandedNodes.has(node.id) && !fullyExpandedNodes.has(node.id)) {
                                await handleNodeExpand(node.id);
                              }
                            }
                          }}
                          disabled={selectedNodes.every(n => expandedNodes.has(n.id) || fullyExpandedNodes.has(n.id))}
                          fullWidth
                        >
                          Expand
                        </Button>
                      )}

                      {selectedNodes.length >= 2 && (
                        <Button
                          size='xs'
                          variant='filled'
                          color='teal'
                          leftIcon={<IconRoute size={14} />}
                          loading={isConnecting}
                          onClick={handleConnectNodes}
                          fullWidth
                        >
                          Connect
                        </Button>
                      )}

                      <Button
                        size='xs'
                        variant='outline'
                        color='red'
                        leftIcon={<IconTrash size={14} />}
                        onClick={handleRemoveSelected}
                        fullWidth
                      >
                        Remove from Graph
                      </Button>
                    </Stack>

                    <Stack spacing='sm'>
                      {selectedNodes.map((node) => (
                        <Group key={`node-${node.id}`} spacing='xs' noWrap>
                          <Text size='sm'>{node.label}</Text>
                          <Badge size='sm' variant='light'>
                            {node.labels?.[0] || 'Node'}
                          </Badge>
                        </Group>
                      ))}
                      {selectedEdges.map((edge) => (
                        <Group key={`edge-${getEdgeKey(edge)}`} spacing='xs' noWrap>
                          <Text size='sm'>{edge.type}</Text>
                          <Badge size='sm' variant='light' color='blue'>
                            Edge
                          </Badge>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                )}

                {selectedEdge && (
                  <Paper
                    p='md'
                    withBorder
                    sx={(theme) => ({
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 300,
                      maxHeight: '600px',
                      overflow: 'auto',
                      backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[7] : theme.white,
                    })}
                  >
                    <Group position='apart' mb='md'>
                      <Title order={4}>Selected Edge</Title>
                      <Button
                        variant='subtle'
                        size='xs'
                        onClick={() => setSelectedEdges([])}
                      >
                        Close
                      </Button>
                    </Group>

                    {/* Isolate button */}
                    <Button
                      size='xs'
                      variant='outline'
                      disabled={isolatedEdge?.from === selectedEdge.from && isolatedEdge?.to === selectedEdge.to}
                      onClick={() => {
                        if (networkInstance.current) {
                          const positions = networkInstance.current.getPositions();
                          savedPositionsRef.current = new Map(
                            Object.entries(positions).map(([id, pos]) => [
                              Number(id),
                              pos as { x: number; y: number },
                            ])
                          );
                        }
                        setIsolatedNodeIds([]);
                        setExpandedNodes(new Map());
                        setFullyExpandedNodes(new Set());
                        setIsolatedEdge({ from: selectedEdge.from, to: selectedEdge.to });
                      }}
                      fullWidth
                      mb='md'
                      styles={(theme) => ({
                        root: {
                          borderColor: theme.colors.cyan[6],
                          color: theme.colors.cyan[4],
                          '&:hover:not(:disabled)': {
                            backgroundColor: theme.colors.cyan[9],
                            borderColor: theme.colors.cyan[5],
                          },
                          '&:disabled': {
                            backgroundColor: theme.colors.dark[6],
                            borderColor: theme.colors.dark[4],
                            color: theme.colors.dark[2],
                          },
                        },
                      })}
                    >
                      Isolate
                    </Button>

                    <Button
                      size='xs'
                      variant='outline'
                      color='red'
                      leftIcon={<IconTrash size={14} />}
                      onClick={handleRemoveSelected}
                      fullWidth
                      mb='md'
                    >
                      Remove from Graph
                    </Button>

                    <Stack spacing='sm'>
                      <Box>
                        <Text fw={500} size='sm' mb={4}>Type:</Text>
                        <Badge size='sm' variant='light'>
                          {selectedEdge.type}
                        </Badge>
                      </Box>

                      <Box>
                        <Text fw={500} size='sm' mb={4}>From → To:</Text>
                        <Text size='sm' c='dimmed'>
                          {selectedEdge.from} → {selectedEdge.to}
                        </Text>
                      </Box>

                      {selectedEdge.properties && Object.keys(selectedEdge.properties).length > 0 && (
                        <Box>
                          <Text fw={500} size='sm' mb={4}>Properties:</Text>
                          <Code block style={{ fontSize: '12px', maxHeight: '300px', overflow: 'auto' }}>
                            {JSON.stringify(selectedEdge.properties, null, 2)}
                          </Code>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                )}
              </Box>
            )}
          </Paper>
        )}

        {customQueryResult && (
          <Paper p='md' withBorder>
            <Title order={4} mb='md'>Query Results</Title>
            <Group mb='md'>
              <Badge color='green'>
                Records: {customQueryResult.recordCount}
              </Badge>
              <Badge variant='light'>
                Query Type: {customQueryResult.summary?.queryType}
              </Badge>
            </Group>
            {customQueryResult.summary?.counters && (
              <Code block mb='md' style={{ fontSize: '12px' }}>
                {Object.entries(customQueryResult.summary.counters)
                  .filter(([, v]) => (v as number) > 0)
                  .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').trim()}: ${v}`)
                  .join(', ') || 'No changes made'}
              </Code>
            )}
            <Code block style={{ maxHeight: '400px', overflow: 'auto' }}>
              {JSON.stringify(customQueryResult.results, null, 2)}
            </Code>
          </Paper>
        )}
        </Stack>
      )}
    </Stack>
  );
}
