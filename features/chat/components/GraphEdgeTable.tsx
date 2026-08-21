import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Checkbox, Divider, Group, ScrollArea, Stack, Table, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconDeselect, IconMinus, IconPlus, IconSearch, IconSelectAll, IconSelector } from '@tabler/icons-react';
import { GraphSearchResultData } from '@/features/chat/types/message';
import { evidenceEdgeKey } from '@/features/settings/components/graph-databases/components/graphEdgeKey';

interface GraphEdgeTableProps {
  /** The evidence entry — its `graphData` carries the nodes + cited edges. */
  data: GraphSearchResultData;
  /** Checked node UUIDs (the node panel's selection). Drives the canvas with the edge selection. */
  selectedNodeUuids: string[];
  /** Checked edge keys (UUID-space `src|relType|tgt`). A checked edge renders when both endpoints are checked nodes. */
  selectedEdgeKeys: string[];
  /** Update the node selection (per-row checkbox and select-all union the edges' endpoints in). */
  onNodeSelectionChange: (uuids: string[]) => void;
  /** Update the edge selection. */
  onEdgeSelectionChange: (keys: string[]) => void;
  /**
   * Optional, non-membership action: toggle the given relationships in the canvas operation-set
   * (bulk-op target), independent of the membership checkbox. Wired to both the per-row body click
   * and the header "Select on graph" bulk button — both only appear when this is provided.
   */
  onSelectEdgesOnGraph?: (edgeKeys: string[]) => void;
  /** Edge keys currently in the canvas operation-set; matching rows render the selection highlight. */
  opSelectedEdgeKeys?: string[];
}

// Operation-set (bulk-op target) selection mark — a crisp red left accent bar on the row's first
// cell, mirroring the canvas selection ring (#FF4444). No fill, so it reads as "selected" rather
// than a destructive/error row. Applied to the first cell because box-shadow on a <tr> is unreliable.
const OP_SELECTED_CELL_STYLE = {
  boxShadow: 'inset 3px 0 0 0 #FF4444',
} as const;

// Edge rows are flat strings — a large evidence set can carry hundreds. Cap the DOM and tell the
// user to filter rather than render thousands of rows.
const ROW_CAP = 500;

type EdgeRow = {
  key: string;
  source: string;
  type: string;
  target: string;
  srcUuid: string;
  tgtUuid: string;
};

type SortCol = 'source' | 'type' | 'target';

/**
 * The Relationships panel of the Subgraph Inspector — the symmetric peer of the node table over the
 * SAME subgraph. Each cited edge is a checkbox-selectable row (`Source | Type | Target`) with
 * per-column filter and sort. Selection is UUID-space edge keys; checking an edge pulls its endpoint
 * nodes into the node selection (endpoint integrity).
 */
export default function GraphEdgeTable({
  data,
  selectedNodeUuids,
  selectedEdgeKeys,
  onNodeSelectionChange,
  onEdgeSelectionChange,
  onSelectEdgesOnGraph,
  opSelectedEdgeKeys = [],
}: GraphEdgeTableProps) {
  // Optimistic local state — updates immediately on click, syncs when the parent prop arrives.
  const [localEdgeKeys, setLocalEdgeKeys] = useState(selectedEdgeKeys);
  useEffect(() => { setLocalEdgeKeys(selectedEdgeKeys); }, [selectedEdgeKeys]);
  const [localNodeUuids, setLocalNodeUuids] = useState(selectedNodeUuids);
  useEffect(() => { setLocalNodeUuids(selectedNodeUuids); }, [selectedNodeUuids]);

  const [columnFilters, setColumnFilters] = useState<Record<SortCol, string>>({ source: '', type: '', target: '' });
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' } | null>(null);

  // Neo4j numeric id -> { display name, entity UUID }. The edge endpoints are numeric ids; the
  // selection is in UUID space — this bridges the two.
  const nodeById = useMemo(() => {
    const map = new Map<number, { name: string; uuid: string }>();
    for (const n of data.graphData?.nodes ?? []) {
      map.set(n.id, { name: n.label, uuid: String(n.properties?.id ?? '') });
    }
    return map;
  }, [data.graphData]);

  // Every cited edge of the subgraph as a row, deduped by UUID-space key. The semantic type
  // (`relationType || type`) drives both the displayed Type and the key, mirroring the canvas.
  const edgeRows = useMemo<EdgeRow[]>(() => {
    const rows: EdgeRow[] = [];
    const seen = new Set<string>();
    for (const e of data.graphData?.edges ?? []) {
      const from = nodeById.get(e.from);
      const to = nodeById.get(e.to);
      if (!from || !to || !from.uuid || !to.uuid) {
        continue; // endpoint not in the evidence node set — can't name/cite it, skip
      }
      const relType = e.properties?.relationType || e.type;
      const key = evidenceEdgeKey(from.uuid, relType, to.uuid);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      rows.push({ key, source: from.name, type: relType, target: to.name, srcUuid: from.uuid, tgtUuid: to.uuid });
    }
    return rows;
  }, [data.graphData, nodeById]);

  const edgeKeySet = useMemo(() => new Set(localEdgeKeys), [localEdgeKeys]);
  const nodeUuidSet = useMemo(() => new Set(localNodeUuids), [localNodeUuids]);
  const opSelectedEdgeKeySet = useMemo(() => new Set(opSelectedEdgeKeys), [opSelectedEdgeKeys]);

  // A row's checkbox reflects what's actually on the canvas (endpoint integrity), NOT just the edge
  // axis: an edge renders iff its key is selected AND both endpoints are selected nodes. So when a
  // node is deselected, edges touching it show unchecked here — matching the canvas.
  const isEffectivelySelected = useCallback(
    (r: EdgeRow) => edgeKeySet.has(r.key) && nodeUuidSet.has(r.srcUuid) && nodeUuidSet.has(r.tgtUuid),
    [edgeKeySet, nodeUuidSet],
  );

  const filteredRows = useMemo(() => {
    const sf = columnFilters.source.trim().toLowerCase();
    const tf = columnFilters.type.trim().toLowerCase();
    const gf = columnFilters.target.trim().toLowerCase();
    if (!sf && !tf && !gf) {
      return edgeRows;
    }
    return edgeRows.filter(
      (r) =>
        (!sf || r.source.toLowerCase().includes(sf)) &&
        (!tf || r.type.toLowerCase().includes(tf)) &&
        (!gf || r.target.toLowerCase().includes(gf)),
    );
  }, [edgeRows, columnFilters]);

  const sortedRows = useMemo(() => {
    if (!sort) {
      return filteredRows;
    }
    const col = sort.col;
    const sorted = [...filteredRows].sort((a, b) => a[col].localeCompare(b[col], undefined, { numeric: true }));
    return sort.dir === 'asc' ? sorted : sorted.reverse();
  }, [filteredRows, sort]);

  const visibleRows = sortedRows.slice(0, ROW_CAP);
  const activeFilterCount = (Object.values(columnFilters) as string[]).filter((v) => v.trim() !== '').length;

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every(isEffectivelySelected);
  const someFilteredSelected = filteredRows.some(isEffectivelySelected);
  const effectiveSelectedCount = edgeRows.filter(isEffectivelySelected).length;

  // Op-set (canvas selection) tally + bulk targets, scoped to the filtered, on-graph relationships.
  // Select all unions the not-yet-selected ones in; Clear toggles the selected ones out
  // (onSelectEdgesOnGraph is a toggle, so an all-unselected / all-selected slice acts one-way).
  const opSelectedEdgeCount = useMemo(
    () => edgeRows.filter((r) => opSelectedEdgeKeySet.has(r.key)).length,
    [edgeRows, opSelectedEdgeKeySet],
  );
  const opSelectableEdgeKeys = useMemo(
    () => filteredRows.filter((r) => isEffectivelySelected(r) && !opSelectedEdgeKeySet.has(r.key)).map((r) => r.key),
    [filteredRows, isEffectivelySelected, opSelectedEdgeKeySet],
  );
  const opClearableEdgeKeys = useMemo(
    () => filteredRows.filter((r) => opSelectedEdgeKeySet.has(r.key)).map((r) => r.key),
    [filteredRows, opSelectedEdgeKeySet],
  );
  const hasMembershipAction = (filteredRows.length > 0 && !allFilteredSelected) || someFilteredSelected;
  const hasSelectionAction = !!onSelectEdgesOnGraph && (opSelectableEdgeKeys.length > 0 || opClearableEdgeKeys.length > 0);

  const commitEdges = useCallback((next: string[]) => {
    setLocalEdgeKeys(next);
    onEdgeSelectionChange(next);
  }, [onEdgeSelectionChange]);

  // Union the given endpoint UUIDs into the node selection (skip already-present). No-op if nothing
  // new, so we never re-fire the parent for a redundant set.
  const unionNodeEndpoints = useCallback((endpoints: string[]) => {
    const set = new Set(localNodeUuids);
    const next = [...localNodeUuids];
    for (const u of endpoints) {
      if (u && !set.has(u)) {
        set.add(u);
        next.push(u);
      }
    }
    if (next.length !== localNodeUuids.length) {
      setLocalNodeUuids(next);
      onNodeSelectionChange(next);
    }
  }, [localNodeUuids, onNodeSelectionChange]);

  // Per-row checkbox toggles the EFFECTIVE (on-canvas) state. Check → ensure the key is selected AND
  // pull both endpoints into the node selection (so it actually renders). Uncheck → drop the key only
  // (leave the nodes — other edges may need them). This makes the checkbox honest when an endpoint
  // was deselected: it shows unchecked, and clicking it re-adds the endpoint and renders the edge.
  const handleToggleEdge = useCallback((row: EdgeRow) => {
    if (isEffectivelySelected(row)) {
      commitEdges(localEdgeKeys.filter((k) => k !== row.key));
    } else {
      if (!edgeKeySet.has(row.key)) {
        commitEdges([...localEdgeKeys, row.key]);
      }
      unionNodeEndpoints([row.srcUuid, row.tgtUuid]);
    }
  }, [isEffectivelySelected, edgeKeySet, localEdgeKeys, commitEdges, unionNodeEndpoints]);

  // Bulk add (FILTERED subset): select every filtered edge (∪) and pull all their endpoints into the
  // node selection so each one actually renders. No-op for edges already selected.
  const handleAddAll = useCallback(() => {
    if (filteredRows.length === 0) {
      return;
    }
    const existing = new Set(localEdgeKeys);
    const next = [...localEdgeKeys];
    for (const r of filteredRows) {
      if (!existing.has(r.key)) {
        existing.add(r.key);
        next.push(r.key);
      }
    }
    if (next.length !== localEdgeKeys.length) {
      commitEdges(next);
    }
    unionNodeEndpoints(filteredRows.flatMap((r) => [r.srcUuid, r.tgtUuid]));
  }, [filteredRows, localEdgeKeys, commitEdges, unionNodeEndpoints]);

  // Bulk remove (FILTERED subset): drop the filtered edges' keys, leaving non-filtered edges (and all
  // nodes) untouched — mirrors per-row uncheck, which removes the edge but keeps shared endpoints.
  const handleRemoveAll = useCallback(() => {
    if (filteredRows.length === 0) {
      return;
    }
    const fset = new Set(filteredRows.map((r) => r.key));
    const next = localEdgeKeys.filter((k) => !fset.has(k));
    if (next.length !== localEdgeKeys.length) {
      commitEdges(next);
    }
  }, [filteredRows, localEdgeKeys, commitEdges]);

  const handleSort = useCallback((col: SortCol) => {
    setSort((prev) => (prev?.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));
  }, []);

  const handleFilterChange = useCallback((col: SortCol, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [col]: value }));
  }, []);

  if (edgeRows.length === 0) {
    return (
      <Box px='md' py='sm'>
        <Text size='xs' color='dimmed'>
          No relationships in this subgraph.
        </Text>
      </Box>
    );
  }

  const COLUMNS: { key: SortCol; label: string }[] = [
    { key: 'source', label: 'Source' },
    { key: 'type', label: 'Type' },
    { key: 'target', label: 'Target' },
  ];

  const filterInputStyles = {
    input: {
      minHeight: 22,
      height: 22,
      fontSize: 10,
      backgroundColor: 'var(--mantine-color-dark-6)',
      border: '1px solid var(--mantine-color-dark-4)',
    },
  };

  return (
    <Stack spacing={0} h='100%'>
      {/* Two-tier header: a unified status line, then the mirrored bulk actions grouped by axis. */}
      <Stack spacing={4} px='sm' py={6} sx={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}>
        {/* relationships (legible white) · on graph (cyan = membership) · selected (red = canvas
            selection). The selection segment shows only when the op-set channel is wired. */}
        <Text size='xs' c='gray.2' truncate>
          {activeFilterCount > 0
            ? `${filteredRows.length} of ${edgeRows.length} relationships`
            : `${edgeRows.length} relationship${edgeRows.length === 1 ? '' : 's'}`}
          {' · '}
          <Text span color='cyan.4' fw={600}>{effectiveSelectedCount} on graph</Text>
          {onSelectEdgesOnGraph && (
            <>
              {' · '}
              <Text span color='red.5' fw={600}>{opSelectedEdgeCount} selected</Text>
            </>
          )}
        </Text>

        {/* Membership (cyan) | canvas selection (red). Each action hides when it has nothing to act on. */}
        {(hasMembershipAction || hasSelectionAction) && (
          <Group spacing={6}>
            {filteredRows.length > 0 && !allFilteredSelected && (
              <Tooltip label={activeFilterCount > 0 ? 'Add the filtered relationships to the graph' : 'Add all relationships to the graph'} withinPortal>
                <Button compact size='xs' variant='subtle' color='cyan' leftIcon={<IconPlus size={12} />} onClick={handleAddAll}>
                  Add all
                </Button>
              </Tooltip>
            )}
            {someFilteredSelected && (
              <Tooltip label={activeFilterCount > 0 ? 'Remove the filtered relationships from the graph' : 'Remove all relationships from the graph'} withinPortal>
                <Button compact size='xs' variant='subtle' color='cyan' leftIcon={<IconMinus size={12} />} onClick={handleRemoveAll}>
                  Remove all
                </Button>
              </Tooltip>
            )}
            {hasMembershipAction && hasSelectionAction && (
              <Divider orientation='vertical' sx={{ height: 18, alignSelf: 'center' }} />
            )}
            {onSelectEdgesOnGraph && opSelectableEdgeKeys.length > 0 && (
              <Tooltip label='Select the on-graph relationships on the canvas for bulk actions' withinPortal>
                <Button compact size='xs' variant='subtle' color='red' leftIcon={<IconSelectAll size={12} />} onClick={() => onSelectEdgesOnGraph(opSelectableEdgeKeys)}>
                  Select all
                </Button>
              </Tooltip>
            )}
            {onSelectEdgesOnGraph && opClearableEdgeKeys.length > 0 && (
              <Tooltip label='Deselect these relationships on the canvas' withinPortal>
                <Button compact size='xs' variant='subtle' color='red' leftIcon={<IconDeselect size={12} />} onClick={() => onSelectEdgesOnGraph(opClearableEdgeKeys)}>
                  Deselect all
                </Button>
              </Tooltip>
            )}
          </Group>
        )}
      </Stack>

      <ScrollArea sx={{ flex: 1, minHeight: 0 }}>
        <Table fontSize='xs' striped highlightOnHover sx={{ 'td, th': { padding: '4px 8px' } }}>
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              {COLUMNS.map(({ key, label }) => (
                <th key={key}>
                  <Stack spacing={2}>
                    <UnstyledButton
                      onClick={() => handleSort(key)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                    >
                      <Text size='xs' fw={700}>{label}</Text>
                      {sort?.col === key
                        ? (sort.dir === 'asc' ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />)
                        : <IconSelector size={12} style={{ opacity: 0.45 }} />}
                    </UnstyledButton>
                    <TextInput
                      size='xs'
                      placeholder='Filter...'
                      value={columnFilters[key]}
                      onChange={(e) => handleFilterChange(key, e.currentTarget.value)}
                      icon={<IconSearch size={10} />}
                      styles={filterInputStyles}
                    />
                  </Stack>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr
                key={r.key}
                onClick={onSelectEdgesOnGraph && isEffectivelySelected(r) ? () => onSelectEdgesOnGraph([r.key]) : undefined}
                style={{
                  cursor: onSelectEdgesOnGraph && isEffectivelySelected(r) ? 'pointer' : undefined,
                }}
              >
                <td style={{ width: 36, ...(opSelectedEdgeKeySet.has(r.key) ? OP_SELECTED_CELL_STYLE : null) }}>
                  <Checkbox
                    size='xs'
                    checked={isEffectivelySelected(r)}
                    onChange={() => handleToggleEdge(r)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td>{r.source}</td>
                <td>
                  <Text size='xs' color='cyan.4'>
                    {r.type}
                  </Text>
                </td>
                <td>{r.target}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {sortedRows.length > ROW_CAP && (
          <Text size='xs' color='dimmed' ta='center' py='xs'>
            Showing first {ROW_CAP} of {sortedRows.length} — filter to narrow.
          </Text>
        )}
      </ScrollArea>
    </Stack>
  );
}
