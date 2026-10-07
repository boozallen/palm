import { useState } from 'react';
import { Box, SegmentedControl, Stack } from '@mantine/core';
import { GraphSearchResultData } from '@/features/chat/types/message';
import { allEdgeKeys } from '@/features/settings/components/graph-databases/components/graphEdgeKey';
import GraphSearchTable from './GraphSearchTable';
import GraphEdgeTable from './GraphEdgeTable';

interface SubgraphInspectorProps {
  data: GraphSearchResultData;
  /** Checked node UUIDs (lifted to ChatProvider as graphEntityIds). */
  selectedNodeUuids: string[];
  /** Checked edge keys (local to GraphVisualization). */
  selectedEdgeKeys: string[];
  onNodeSelectionChange: (uuids: string[]) => void;
  onEdgeSelectionChange: (keys: string[]) => void;
  /** Optional bulk-select actions: select the filtered nodes / relationships in the canvas
   *  operation-set (bulk-op target), independent of membership. Buttons render only when provided. */
  onSelectNodesOnGraph?: (uuids: string[]) => void;
  onSelectEdgesOnGraph?: (keys: string[]) => void;
  /** Operation-set identifiers, so op-selected rows render the canvas selection highlight. */
  opSelectedNodeUuids?: string[];
  opSelectedEdgeKeys?: string[];
}

/**
 * Two symmetric, filterable, sortable, checkbox-driven panels over one answer-evidence subgraph:
 * Nodes (`Kind | Name | Type | Description`) and Relationships (`Source | Type | Target`). Selecting
 * or filtering in either panel drives the canvas; per-row checkbox and select-all are additive.
 */
export default function SubgraphInspector({
  data,
  selectedNodeUuids,
  selectedEdgeKeys,
  onNodeSelectionChange,
  onEdgeSelectionChange,
  onSelectNodesOnGraph,
  onSelectEdgesOnGraph,
  opSelectedNodeUuids,
  opSelectedEdgeKeys,
}: SubgraphInspectorProps) {
  const [view, setView] = useState<'nodes' | 'relationships'>('nodes');
  const edgeCount = data.graphData ? allEdgeKeys(data.graphData).length : 0;

  return (
    <Stack spacing={0} h='100%'>
      <Box px='sm' py={6} sx={{ flexShrink: 0, borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
        <SegmentedControl
          size='xs'
          fullWidth
          value={view}
          onChange={(v) => setView(v as 'nodes' | 'relationships')}
          data={[
            { label: `Nodes (${data.rowCount})`, value: 'nodes' },
            { label: `Relationships (${edgeCount})`, value: 'relationships' },
          ]}
        />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {view === 'nodes' ? (
          <GraphSearchTable
            data={data}
            selectedEntityIds={selectedNodeUuids}
            onSelectionChange={onNodeSelectionChange}
            onSelectOnGraph={onSelectNodesOnGraph}
            opSelectedEntityIds={opSelectedNodeUuids}
            sortable
          />
        ) : (
          <GraphEdgeTable
            data={data}
            selectedNodeUuids={selectedNodeUuids}
            selectedEdgeKeys={selectedEdgeKeys}
            onNodeSelectionChange={onNodeSelectionChange}
            onEdgeSelectionChange={onEdgeSelectionChange}
            onSelectEdgesOnGraph={onSelectEdgesOnGraph}
            opSelectedEdgeKeys={opSelectedEdgeKeys}
          />
        )}
      </Box>
    </Stack>
  );
}
