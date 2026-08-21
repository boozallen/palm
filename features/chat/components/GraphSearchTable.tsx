import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { Box, Button, Checkbox, Divider, Group, ScrollArea, Stack, Table, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconDeselect, IconMinus, IconPlus, IconSearch, IconSelectAll, IconSelector } from '@tabler/icons-react';
import { GraphSearchResultData } from '@/features/chat/types/message';

interface GraphSearchTableProps {
  data: GraphSearchResultData;
  selectedEntityIds: string[];
  onSelectionChange: (entityIds: string[]) => void;
  /** Evidence mode: enable click-to-sort headers. Default off so enumeration is unchanged. */
  sortable?: boolean;
  /**
   * Optional, non-membership action: toggle the given rows' nodes in the canvas operation-set
   * (bulk-op target), independent of the add/remove-from-graph checkbox. Wired to both the per-row
   * body click and the header "Select on graph" bulk button — both only appear when this is provided.
   */
  onSelectOnGraph?: (entityIds: string[]) => void;
  /**
   * Entity UUIDs currently in the canvas operation-set. Rows whose nodes are all in this set render
   * with the selection highlight that matches the canvas red ring. Reflects canvas-side selections
   * too, so the table and canvas stay in sync.
   */
  opSelectedEntityIds?: string[];
}

const BATCH_SIZE = 50;

const TABLE_STYLES = {
  'td, th': { padding: '4px 8px' },
  td: { whiteSpace: 'normal' as const, overflowWrap: 'break-word' as const, maxWidth: 300 },
};

// Operation-set (bulk-op target) selection mark — a crisp red left accent bar on the row's first
// cell, mirroring the canvas selection ring (#FF4444). No fill, so it reads as "selected" rather
// than a destructive/error row and stays clean over the membership-pinned background. Applied to the
// first cell (not the <tr>) because box-shadow on a table row renders unreliably across browsers.
const OP_SELECTED_CELL_STYLE = {
  boxShadow: 'inset 3px 0 0 0 #FF4444',
} as const;

export default function GraphSearchTable({
  data,
  selectedEntityIds,
  onSelectionChange,
  sortable = false,
  onSelectOnGraph,
  opSelectedEntityIds = [],
}: GraphSearchTableProps) {
  // Optimistic local state — updates immediately on click, syncs when parent prop arrives
  const [localSelectedIds, setLocalSelectedIds] = useState(selectedEntityIds);
  useEffect(() => { setLocalSelectedIds(selectedEntityIds); }, [selectedEntityIds]);

  const selectedSet = useMemo(() => new Set(localSelectedIds), [localSelectedIds]);
  const opSelectedSet = useMemo(() => new Set(opSelectedEntityIds), [opSelectedEntityIds]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLTableRowElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Cell-level: "rowIndex:colKey" -> entityIds (new convention with colKey)
  const cellEntityMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { rowIndex, colKey, entityIds } of data.nodeMapping) {
      if (colKey) {
        map.set(`${rowIndex}:${colKey}`, entityIds);
      }
    }
    return map;
  }, [data.nodeMapping]);

  // Row-level fallback (old data without colKey)
  const rowEntityMap = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const { rowIndex, colKey, entityIds } of data.nodeMapping) {
      if (!colKey) {
        map.set(rowIndex, entityIds);
      }
    }
    return map;
  }, [data.nodeMapping]);

  const isCellLevel = cellEntityMap.size > 0;

  const columns = useMemo(() => {
    if (data.rows.length === 0) {return [];}
    return Object.keys(data.rows[0]);
  }, [data.rows]);

  // Filter rows by column text filters
  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(columnFilters).filter(([, v]) => v.trim() !== '');
    if (activeFilters.length === 0) {
      return data.rows.map((row, i) => ({ row, originalIndex: i }));
    }

    return data.rows
      .map((row, i) => ({ row, originalIndex: i }))
      .filter(({ row }) =>
        activeFilters.every(([col, filter]) => {
          const val = formatCellValue(row[col]).toLowerCase();
          return val.includes(filter.toLowerCase());
        })
      );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.rows, columnFilters]);

  // Opt-in sort (evidence mode). Applied AFTER filtering, BEFORE the pinned/unpinned split, on the
  // {row, originalIndex} pairs so selection still maps via originalIndex. Off → identity order.
  const sortedRows = useMemo(() => {
    if (!sortable || !sort) {return filteredRows;}
    const col = sort.col;
    const sorted = [...filteredRows].sort((a, b) =>
      formatCellValue(a.row[col]).localeCompare(formatCellValue(b.row[col]), undefined, { numeric: true }),
    );
    return sort.dir === 'asc' ? sorted : sorted.reverse();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, sort, sortable]);

  const handleSort = useCallback((col: string) => {
    setSort(prev => (prev?.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));
  }, []);

  // Filtered selectable IDs — entity IDs from visible rows
  const filteredSelectableIds = useMemo(() => {
    if (isCellLevel) {
      return filteredRows.flatMap(({ originalIndex }) => {
        const ids: string[] = [];
        for (const col of columns) {
          const cellIds = cellEntityMap.get(`${originalIndex}:${col}`);
          if (cellIds) {ids.push(...cellIds);}
        }
        return ids;
      });
    }
    return filteredRows.flatMap(({ originalIndex }) => rowEntityMap.get(originalIndex) || []);
  }, [filteredRows, isCellLevel, cellEntityMap, rowEntityMap, columns]);

  const allSelected = filteredSelectableIds.length > 0 && filteredSelectableIds.every(id => selectedSet.has(id));
  const someSelected = filteredSelectableIds.some(id => selectedSet.has(id));

  // Entity IDs contributed by result row `i` (cell-level unions every cell; row-level is the row map).
  const rowIdsAt = useCallback(
    (i: number) =>
      isCellLevel
        ? columns.flatMap(col => cellEntityMap.get(`${i}:${col}`) ?? [])
        : rowEntityMap.get(i) ?? [],
    [isCellLevel, columns, cellEntityMap, rowEntityMap],
  );
  const countRows = useCallback(
    (set: Set<string>) => {
      let count = 0;
      for (let i = 0; i < data.rows.length; i++) {
        const ids = rowIdsAt(i);
        if (ids.length > 0 && ids.every(id => set.has(id))) {count++;}
      }
      return count;
    },
    [data.rows, rowIdsAt],
  );

  // Row-scoped tallies (mirror the edge table): how many result rows are on the canvas, and how many
  // are in the canvas operation-set. Both tied to THIS table's rows — not total canvas membership
  // (localSelectedIds), which can include nodes added by expansion.
  const onGraphRowCount = useMemo(() => countRows(selectedSet), [countRows, selectedSet]);
  const opSelectedRowCount = useMemo(
    () => (opSelectedEntityIds.length === 0 ? 0 : countRows(opSelectedSet)),
    [countRows, opSelectedSet, opSelectedEntityIds.length],
  );

  // Op-set (canvas selection) bulk targets, scoped to the filtered, on-graph rows. Select all unions
  // the not-yet-selected members in; Clear toggles the selected ones back out — onSelectOnGraph is a
  // toggle, so passing an all-unselected / all-selected slice yields a clean one-way action.
  const filteredMemberIds = useMemo(
    () => filteredSelectableIds.filter(id => selectedSet.has(id)),
    [filteredSelectableIds, selectedSet],
  );
  const opSelectableIds = useMemo(
    () => filteredMemberIds.filter(id => !opSelectedSet.has(id)),
    [filteredMemberIds, opSelectedSet],
  );
  const opClearableIds = useMemo(
    () => filteredMemberIds.filter(id => opSelectedSet.has(id)),
    [filteredMemberIds, opSelectedSet],
  );

  // Split filtered rows into selected (pinned) and unselected (scrollable)
  const { pinnedRows, unpinnedRows } = useMemo(() => {
    const pinned: { row: Record<string, unknown>; originalIndex: number }[] = [];
    const unpinned: { row: Record<string, unknown>; originalIndex: number }[] = [];

    sortedRows.forEach(({ row, originalIndex }) => {
      let isSelected: boolean;
      if (isCellLevel) {
        isSelected = columns.some(col => {
          const cellIds = cellEntityMap.get(`${originalIndex}:${col}`);
          return cellIds && cellIds.length > 0 && cellIds.every(id => selectedSet.has(id));
        });
      } else {
        const entityIds = rowEntityMap.get(originalIndex);
        isSelected = entityIds?.every(id => selectedSet.has(id)) ?? false;
      }
      (isSelected ? pinned : unpinned).push({ row, originalIndex });
    });

    if (unpinned.length === 0) {
      return { pinnedRows: [], unpinnedRows: pinned };
    }
    return { pinnedRows: pinned, unpinnedRows: unpinned };
  }, [sortedRows, isCellLevel, cellEntityMap, rowEntityMap, selectedSet, columns]);

  // Reset visible count when filters, sort, or data change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [columnFilters, sort, data.rows]);

  // Intersection observer to load more rows when sentinel becomes visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {return;}

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < unpinnedRows.length) {
          setVisibleCount(prev => Math.min(prev + BATCH_SIZE, unpinnedRows.length));
        }
      },
      { root: scrollAreaRef.current, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, unpinnedRows.length]);

  const visibleUnpinnedRows = unpinnedRows.slice(0, visibleCount);

  // Bulk add: union the not-yet-selected filtered rows into the graph. No-op if all are already in.
  const handleAddAll = useCallback(() => {
    const newIds = filteredSelectableIds.filter(id => !selectedSet.has(id));
    if (newIds.length === 0) {return;}
    const next = [...localSelectedIds, ...newIds];
    setLocalSelectedIds(next);
    onSelectionChange(next);
  }, [filteredSelectableIds, selectedSet, localSelectedIds, onSelectionChange]);

  // Bulk remove: drop every filtered row from the graph, leaving the non-filtered selection intact.
  const handleRemoveAll = useCallback(() => {
    const filteredSet = new Set(filteredSelectableIds);
    const next = localSelectedIds.filter(id => !filteredSet.has(id));
    if (next.length === localSelectedIds.length) {return;}
    setLocalSelectedIds(next);
    onSelectionChange(next);
  }, [filteredSelectableIds, localSelectedIds, onSelectionChange]);

  const handleToggle = useCallback((entityIds: string[]) => {
    const isSelected = entityIds.every(id => selectedSet.has(id));
    let next: string[];
    if (isSelected) {
      next = localSelectedIds.filter(id => !entityIds.includes(id));
    } else {
      next = [...localSelectedIds, ...entityIds.filter(id => !selectedSet.has(id))];
    }
    setLocalSelectedIds(next);
    onSelectionChange(next);
  }, [localSelectedIds, selectedSet, onSelectionChange]);

  const handleFilterChange = useCallback((col: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [col]: value }));
  }, []);

  // Per-column entity IDs (for column-level select-all in cell mode)
  const columnEntityIds = useMemo(() => {
    if (!isCellLevel) {return new Map<string, string[]>();}
    const map = new Map<string, string[]>();
    for (const { originalIndex } of filteredRows) {
      for (const col of columns) {
        const cellIds = cellEntityMap.get(`${originalIndex}:${col}`);
        if (cellIds) {
          const existing = map.get(col) || [];
          existing.push(...cellIds);
          map.set(col, existing);
        }
      }
    }
    return map;
  }, [isCellLevel, filteredRows, columns, cellEntityMap]);

  const handleColumnToggle = useCallback((col: string) => {
    const colIds = columnEntityIds.get(col);
    if (!colIds || colIds.length === 0) {return;}
    const allColSelected = colIds.every(id => selectedSet.has(id));
    let next: string[];
    if (allColSelected) {
      const colSet = new Set(colIds);
      next = localSelectedIds.filter(id => !colSet.has(id));
    } else {
      const newIds = colIds.filter(id => !selectedSet.has(id));
      next = [...localSelectedIds, ...newIds];
    }
    setLocalSelectedIds(next);
    onSelectionChange(next);
  }, [columnEntityIds, selectedSet, localSelectedIds, onSelectionChange]);

  const activeFilterCount = Object.values(columnFilters).filter(v => v.trim() !== '').length;

  // Drive the action row + axis divider: is there at least one membership action, one selection action?
  const hasMembershipAction = (filteredSelectableIds.length > 0 && !allSelected) || someSelected;
  const hasSelectionAction = !!onSelectOnGraph && (opSelectableIds.length > 0 || opClearableIds.length > 0);

  function formatCellValue(val: unknown): string {
    if (val === null || val === undefined) {return '';}
    if (Array.isArray(val)) {return val.map(v => formatCellValue(v)).join(', ');}
    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      if (typeof obj.year === 'number' && typeof obj.month === 'number' && typeof obj.day === 'number') {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${obj.year}-${pad(obj.month)}-${pad(obj.day)}`;
      }
      return JSON.stringify(val);
    }
    return String(val);
  }

  const toTitleCase = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\s+/, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const renderRow = (row: Record<string, unknown>, originalIndex: number) => {
    if (isCellLevel) {
      // Collect all entity IDs across all cells in this row for the row-level checkbox
      const rowAllIds: string[] = [];
      for (const col of columns) {
        const cellIds = cellEntityMap.get(`${originalIndex}:${col}`);
        if (cellIds) {rowAllIds.push(...cellIds);}
      }
      const hasRowCheckbox = rowAllIds.length > 0;
      const allRowChecked = hasRowCheckbox && rowAllIds.every(id => selectedSet.has(id));
      const someRowChecked = hasRowCheckbox && rowAllIds.some(id => selectedSet.has(id));
      const isRowOpSelected = hasRowCheckbox && rowAllIds.every(id => opSelectedSet.has(id));
      // Only rows already on the canvas (members) can join the op-set — clicking an off-graph row
      // would be a no-op, so it isn't given the pointer affordance or click handler.
      const canSelectOnGraph = !!onSelectOnGraph && allRowChecked;

      return (
        <tr
          key={originalIndex}
          onClick={canSelectOnGraph ? () => onSelectOnGraph!(rowAllIds) : undefined}
          style={{ cursor: canSelectOnGraph ? 'pointer' : undefined }}
        >
          <td style={{ width: 36, ...(isRowOpSelected ? OP_SELECTED_CELL_STYLE : null) }}>
            {hasRowCheckbox && (
              <Checkbox
                size='xs'
                checked={allRowChecked}
                indeterminate={someRowChecked && !allRowChecked}
                onChange={() => handleToggle(rowAllIds)}
                onClick={e => e.stopPropagation()}
              />
            )}
          </td>
          {columns.map(col => {
            const cellIds = cellEntityMap.get(`${originalIndex}:${col}`);
            const hasCheckbox = cellIds && cellIds.length > 0;
            const isChecked = hasCheckbox && cellIds.every(id => selectedSet.has(id));

            return (
              <td key={col} title={formatCellValue(row[col])}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                  {hasCheckbox && (
                    <Checkbox
                      size='xs'
                      checked={isChecked}
                      onChange={() => handleToggle(cellIds)}
                      onClick={e => e.stopPropagation()}
                      styles={{ root: { flexShrink: 0, marginTop: 2 } }}
                    />
                  )}
                  <div style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {formatCellValue(row[col])}
                  </div>
                </div>
              </td>
            );
          })}
        </tr>
      );
    }

    // Row-level fallback (old data without colKey)
    const entityIds = rowEntityMap.get(originalIndex);
    const hasCheckbox = entityIds && entityIds.length > 0;
    const isChecked = hasCheckbox && entityIds.every(id => selectedSet.has(id));
    const isRowOpSelected = hasCheckbox && entityIds.every(id => opSelectedSet.has(id));
    // With the op-set handler wired, body click toggles op-set selection — but only for rows already
    // on the canvas (members); membership stays on the checkbox. Without it, fall back to the legacy
    // behavior of toggling membership on row click.
    const opClickable = !!onSelectOnGraph && isChecked;
    const handleRowClick = !onSelectOnGraph
      ? (hasCheckbox ? () => handleToggle(entityIds!) : undefined)
      : (opClickable ? () => onSelectOnGraph(entityIds!) : undefined);
    const showPointer = onSelectOnGraph ? opClickable : !!hasCheckbox;

    return (
      <tr
        key={originalIndex}
        onClick={handleRowClick}
        style={{ cursor: showPointer ? 'pointer' : 'default' }}
      >
        <td style={{ width: 36, ...(isRowOpSelected ? OP_SELECTED_CELL_STYLE : null) }}>
          {hasCheckbox && (
            <Checkbox
              size='xs'
              checked={isChecked}
              onChange={() => handleToggle(entityIds)}
              onClick={e => e.stopPropagation()}
            />
          )}
        </td>
        {columns.map(col => (
          <td key={col} title={formatCellValue(row[col])}>
            <div style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {formatCellValue(row[col])}
            </div>
          </td>
        ))}
      </tr>
    );
  };

  const colSpan = columns.length + 1;

  // Shared <colgroup> + tableLayout:'fixed' so all three tables (header,
  // pinned, scrollable) compute identical column widths. The min-width forces
  // the table wider than its container when there are many columns, and the
  // outer Box scrolls horizontally to keep header + body in lockstep.
  const MIN_DATA_COL_WIDTH = 150;
  const tableMinWidth = 36 + columns.length * MIN_DATA_COL_WIDTH;
  const renderColgroup = () => (
    <colgroup>
      <col style={{ width: 36 }} />
      {columns.map(col => <col key={col} />)}
    </colgroup>
  );
  const fixedTableSx = {
    ...TABLE_STYLES,
    tableLayout: 'fixed' as const,
    minWidth: tableMinWidth,
    width: '100%',
  };

  return (
    <Stack spacing={0} h='100%'>
      {/* Header banner — outside horizontal scroll so the status stays put. Two tiers: a unified
          status line, then the mirrored bulk actions grouped by axis. */}
      <Stack spacing={4} px='sm' py={6} sx={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}>
        {/* results (legible white) · on graph (cyan = membership) · selected (red = canvas selection).
            The selection segment shows only when the op-set channel is wired. */}
        <Text size='xs' c='gray.2' truncate>
          {activeFilterCount > 0 ? `${filteredRows.length} of ${data.rowCount} results` : `${data.rowCount} results`}
          {' · '}
          <Text span color='cyan.4' fw={600}>{onGraphRowCount} on graph</Text>
          {onSelectOnGraph && (
            <>
              {' · '}
              <Text span color='red.5' fw={600}>{opSelectedRowCount} selected</Text>
            </>
          )}
        </Text>

        {/* Membership (cyan) | canvas selection (red). Each action hides when it has nothing to act on. */}
        {(hasMembershipAction || hasSelectionAction) && (
          <Group spacing={6}>
            {filteredSelectableIds.length > 0 && !allSelected && (
              <Tooltip label={activeFilterCount > 0 ? 'Add the filtered rows to the graph' : 'Add all rows to the graph'} withinPortal>
                <Button compact size='xs' variant='subtle' color='cyan' leftIcon={<IconPlus size={12} />} onClick={handleAddAll}>
                  Add all
                </Button>
              </Tooltip>
            )}
            {someSelected && (
              <Tooltip label={activeFilterCount > 0 ? 'Remove the filtered rows from the graph' : 'Remove all rows from the graph'} withinPortal>
                <Button compact size='xs' variant='subtle' color='cyan' leftIcon={<IconMinus size={12} />} onClick={handleRemoveAll}>
                  Remove all
                </Button>
              </Tooltip>
            )}
            {hasMembershipAction && hasSelectionAction && (
              <Divider orientation='vertical' sx={{ height: 18, alignSelf: 'center' }} />
            )}
            {onSelectOnGraph && opSelectableIds.length > 0 && (
              <Tooltip label='Select the on-graph rows on the canvas for bulk actions' withinPortal>
                <Button compact size='xs' variant='subtle' color='red' leftIcon={<IconSelectAll size={12} />} onClick={() => onSelectOnGraph(opSelectableIds)}>
                  Select all
                </Button>
              </Tooltip>
            )}
            {onSelectOnGraph && opClearableIds.length > 0 && (
              <Tooltip label='Deselect these rows on the canvas' withinPortal>
                <Button compact size='xs' variant='subtle' color='red' leftIcon={<IconDeselect size={12} />} onClick={() => onSelectOnGraph(opClearableIds)}>
                  Deselect all
                </Button>
              </Tooltip>
            )}
          </Group>
        )}
      </Stack>

      {/* Single horizontal-scroll wrapper so header + pinned + scrollable
          shift left/right together. Inner Stack carries the min-width that
          forces the scrollbar when needed. */}
      <Box sx={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden' }}>
        <Stack spacing={0} sx={{ height: '100%', minWidth: tableMinWidth }}>

      {/* Column headers + filter inputs */}
      <Table fontSize='xs' sx={{ ...fixedTableSx, flexShrink: 0 }}>
        {renderColgroup()}
        <thead>
          <tr>
            <th style={{ width: 36 }} />
            {columns.map(col => {
              const colIds = isCellLevel ? columnEntityIds.get(col) : undefined;
              const hasColCheckbox = colIds && colIds.length > 0;
              const allColSelected = hasColCheckbox && colIds.every(id => selectedSet.has(id));
              const someColSelected = hasColCheckbox && colIds.some(id => selectedSet.has(id));

              return (
              <th key={col}>
                <Stack spacing={2}>
                  <Group spacing={4} noWrap>
                    {hasColCheckbox && (
                      <Checkbox
                        size='xs'
                        checked={allColSelected}
                        indeterminate={someColSelected && !allColSelected}
                        onChange={() => handleColumnToggle(col)}
                        onClick={e => e.stopPropagation()}
                        styles={{ root: { flexShrink: 0 } }}
                      />
                    )}
                    {sortable ? (
                      <UnstyledButton
                        onClick={() => handleSort(col)}
                        sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                      >
                        <Text size='xs' fw={700}>{toTitleCase(col)}</Text>
                        {sort?.col === col
                          ? (sort.dir === 'asc' ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />)
                          : <IconSelector size={12} style={{ opacity: 0.45 }} />}
                      </UnstyledButton>
                    ) : (
                      <Text size='xs' fw={700}>{toTitleCase(col)}</Text>
                    )}
                  </Group>
                  <TextInput
                    size='xs'
                    placeholder='Filter...'
                    value={columnFilters[col] || ''}
                    onChange={e => handleFilterChange(col, e.currentTarget.value)}
                    onClick={e => e.stopPropagation()}
                    icon={<IconSearch size={10} />}
                    styles={{
                      input: {
                        minHeight: 22,
                        height: 22,
                        fontSize: 10,
                        backgroundColor: 'var(--mantine-color-dark-6)',
                        border: '1px solid var(--mantine-color-dark-4)',
                      },
                    }}
                  />
                </Stack>
              </th>
              );
            })}
          </tr>
        </thead>
      </Table>

      {/* Pinned selected rows */}
      {pinnedRows.length > 0 && (
        <Box sx={{ flexShrink: 0, maxHeight: '50%', overflowY: 'auto', backgroundColor: 'var(--mantine-color-dark-5)' }}>
          <Table fontSize='xs' highlightOnHover sx={fixedTableSx}>
            {renderColgroup()}
            <tbody>
              {pinnedRows.map(({ row, originalIndex }) => renderRow(row, originalIndex))}
            </tbody>
          </Table>
        </Box>
      )}

      {/* Divider between pinned and scrollable */}
      {pinnedRows.length > 0 && unpinnedRows.length > 0 && (
        <Group px='sm' py={4} sx={{ backgroundColor: 'var(--mantine-color-cyan-9)', flexShrink: 0 }}>
          <Text size={10} color='cyan.2' fw={600} tt='uppercase' sx={{ letterSpacing: 0.5 }}>
            {unpinnedRows.length} unselected below
          </Text>
        </Group>
      )}

      {/* Scrollable unselected rows — renders in batches */}
      <ScrollArea sx={{ flex: 1 }} viewportRef={scrollAreaRef}>
        <Table fontSize='xs' striped highlightOnHover sx={fixedTableSx}>
          {renderColgroup()}
          <tbody>
            {visibleUnpinnedRows.length > 0 ? (
              <>
                {visibleUnpinnedRows.map(({ row, originalIndex }) => renderRow(row, originalIndex))}
                {visibleCount < unpinnedRows.length && (
                  <tr ref={sentinelRef} style={{ height: 1 }}>
                    <td colSpan={colSpan} style={{ padding: 0, border: 'none' }} />
                  </tr>
                )}
              </>
            ) : (
              <tr>
                <td colSpan={colSpan} style={{ textAlign: 'center', padding: 16 }}>
                  <Text size='xs' color='dimmed'>
                    {activeFilterCount > 0 ? 'No results match filters' : 'No results'}
                  </Text>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </ScrollArea>
        </Stack>
      </Box>
    </Stack>
  );
}
