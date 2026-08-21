import { MouseEvent, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Group,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle,
  IconSearch,
  IconSelector,
  IconShieldDown,
  IconShieldUp,
  IconUsers,
} from '@tabler/icons-react';

export type CollectionRow = {
  id: string;
  name: string;
  color: string | null;
  // Number of documents in the folder that are currently admin data sources.
  // Compared against `count` (total docs) this gives the folder's share state:
  // 0 = none, count = all, anything between = partially shared.
  sharedCount: number;
  // True when the shared documents in the folder are assigned to DIFFERENT
  // group sets (e.g. one doc -> Alpha, another -> Beta). The group badges then
  // show the union, so the folder is flagged as mixed rather than uniform.
  mixedGroups: boolean;
  sharedGroupIds: string[];
  sharedGroupLabels: string[];
  ownerId?: string;
  ownerName?: string;
  count: number;
};

type DocSort = 'asc' | 'desc' | null;

type CollectionsTableProps = {
  collections: CollectionRow[];
  selectedCollectionId: string | null;
  currentUserId: string;
  isAdmin: boolean;
  onSelect: (id: string | null) => void;
  onShare: (id: string, name: string) => void;
  onRemoveShare: (id: string, name: string) => void;
};

export default function CollectionsTable({
  collections,
  selectedCollectionId,
  currentUserId,
  isAdmin,
  onSelect,
  onShare,
  onRemoveShare,
}: Readonly<CollectionsTableProps>) {
  const theme = useMantineTheme();
  const [filterText, setFilterText] = useState('');
  const [sharedFilter, setSharedFilter] = useState<string | null>(null);
  const [docSort, setDocSort] = useState<DocSort>(null);

  const visibleCollections = useMemo(() => {
    let rows = collections;

    const query = filterText.trim().toLowerCase();
    if (query) {
      rows = rows.filter(
        c => c.name.toLowerCase().includes(query) || (c.ownerName ?? '').toLowerCase().includes(query)
      );
    }

    if (sharedFilter === 'shared') {
      rows = rows.filter(c => c.sharedCount > 0);
    } else if (sharedFilter === 'not-shared') {
      rows = rows.filter(c => c.sharedCount === 0);
    }

    if (docSort) {
      rows = [...rows].sort((a, b) => (docSort === 'asc' ? a.count - b.count : b.count - a.count));
    }

    return rows;
  }, [collections, filterText, sharedFilter, docSort]);

  const cycleDocSort = () =>
    setDocSort(prev => (prev === null ? 'desc' : prev === 'desc' ? 'asc' : null));

  const DocSortIcon = docSort === 'asc' ? IconChevronUp : docSort === 'desc' ? IconChevronDown : IconSelector;

  const selectedBg = theme.fn.rgba(theme.colors.blue[6], 0.18);

  return (
    <Stack bg='dark.6' p='md' spacing='sm' data-testid='collections-table'>
      <Group>
        <TextInput
          style={{ flex: 2 }}
          label='Filter collections'
          placeholder='Filter by collection name or owner...'
          icon={<IconSearch size={16} />}
          value={filterText}
          onChange={e => setFilterText(e.currentTarget.value)}
          data-testid='collections-filter-search'
        />
        <Select
          style={{ flex: 1 }}
          label='Shared'
          placeholder='Filter by shared'
          value={sharedFilter}
          onChange={setSharedFilter}
          data={[
            { value: 'shared', label: 'Shared' },
            { value: 'not-shared', label: 'Not shared' },
          ]}
          clearable
          data-testid='collections-filter-shared'
        />
      </Group>

      <ScrollArea.Autosize mah='32vh' placeholder={undefined} onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined}>
        <Table data-testid='collections-table-grid'>
          <thead>
            <tr>
              <th>
                <Text fz='sm' fw={500} data-testid='collections-header-name'>
                  Collection
                </Text>
              </th>
              <th>
                <Text fz='sm' fw={500} data-testid='collections-header-owner'>
                  Owner
                </Text>
              </th>
              <th>
                <UnstyledButton onClick={cycleDocSort} data-testid='collections-sort-docs'>
                  <Group spacing={4} noWrap>
                    <Text fz='sm' fw={500}>
                      Documents
                    </Text>
                    <DocSortIcon size={14} />
                  </Group>
                </UnstyledButton>
              </th>
              <th>
                <Group spacing='xs'>
                  <Text fz='sm' fw={500} data-testid='collections-header-shared'>
                    Share Status (Admin Data Source)
                  </Text>
                  <Tooltip
                    label={
                      <Text fz='xs' mb='xs'>
                        Documents or collections uploaded by Admin users or Group Leads can be made immediately accessible to members of selected user groups.
                      </Text>
                    }
                    multiline
                    width={280}
                    position='top'
                    withinPortal
                  >
                    <IconInfoCircle size={14} style={{ cursor: 'help' }} />
                  </Tooltip>
                </Group>
              </th>
              <th>
                <Text fz='sm' fw={500} data-testid='collections-header-actions'>
                  Actions
                </Text>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleCollections.map(c => {
              const isSelected = c.id === selectedCollectionId;
              const canShare = isAdmin || c.ownerId === currentUserId;
              const shareState =
                c.sharedCount === 0 ? 'none' : c.sharedCount >= c.count ? 'all' : 'partial';
              return (
                <tr
                  key={c.id}
                  onClick={() => onSelect(isSelected ? null : c.id)}
                  style={{ cursor: 'pointer', backgroundColor: isSelected ? selectedBg : undefined }}
                  data-testid={`collection-row-${c.id}`}
                >
                  <td>
                    <Text fz='sm' fw={500} truncate>
                      {c.name}
                    </Text>
                  </td>
                  <td>
                    <Text fz='sm'>
                      {c.ownerName ?? '—'}
                    </Text>
                  </td>
                  <td>
                    <Text fz='sm' data-testid={`collection-docs-${c.id}`}>
                      {c.count}
                    </Text>
                  </td>
                  <td data-testid={`collection-share-status-${c.id}`}>
                    {c.sharedGroupLabels.length > 0 ? (
                      <Stack spacing={4}>
                        <Group spacing='xs'>
                          {c.sharedGroupLabels.slice(0, 2).map(label => (
                            <Badge key={label} variant='outline' color='gray' data-testid={`collection-group-badge-${label}`}>
                              {label}
                            </Badge>
                          ))}
                          {c.sharedGroupLabels.length > 2 && (
                            <Tooltip
                              label={c.sharedGroupLabels.slice(2).join(', ')}
                              withinPortal
                              multiline
                              width={220}
                            >
                              <Badge variant='outline' color='gray' style={{ cursor: 'default' }} data-testid='collection-group-more-badge'>
                                +{c.sharedGroupLabels.length - 2} more
                              </Badge>
                            </Tooltip>
                          )}
                          {c.mixedGroups && (
                            <Tooltip
                              label='Documents in this folder are shared to different groups. The badges show the combined set.'
                              withinPortal
                              multiline
                              width={240}
                            >
                              <Badge color='yellow' variant='light' style={{ cursor: 'default' }} data-testid={`collection-mixed-${c.id}`}>
                                Mixed
                              </Badge>
                            </Tooltip>
                          )}
                        </Group>
                        {shareState === 'partial' && (
                          <Text fz='xs' c='dimmed' data-testid={`collection-partial-${c.id}`}>
                            {c.sharedCount} of {c.count} shared
                          </Text>
                        )}
                      </Stack>
                    ) : (
                      <Text fz='sm' c='dimmed' data-testid={`collection-unshared-${c.id}`}>
                        Unshared
                      </Text>
                    )}
                  </td>
                  <td>
                    {canShare && (
                      <Group spacing='xs'>
                        {shareState === 'all' ? (
                          <Tooltip label='Edit groups' withArrow>
                            <ActionIcon
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation();
                                onShare(c.id, c.name);
                              }}
                              aria-label={`Edit groups for ${c.name}`}
                              data-testid={`edit-collection-groups-${c.id}`}
                            >
                              <IconUsers />
                            </ActionIcon>
                          </Tooltip>
                        ) : (
                          <Tooltip
                            label={shareState === 'partial' ? 'Share remaining documents' : 'Designate as admin data source'}
                            withArrow
                          >
                            <ActionIcon
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation();
                                onShare(c.id, c.name);
                              }}
                              aria-label={
                                shareState === 'partial'
                                  ? `Share remaining documents in ${c.name}`
                                  : `Designate ${c.name} as admin data source`
                              }
                              data-testid={`share-collection-${c.id}`}
                            >
                              <IconShieldUp />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {shareState !== 'none' && (
                          <Tooltip label='Remove share status' withArrow>
                            <ActionIcon
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation();
                                onRemoveShare(c.id, c.name);
                              }}
                              aria-label={`Remove share status for ${c.name}`}
                              data-testid={`remove-collection-share-${c.id}`}
                            >
                              <IconShieldDown />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {visibleCollections.length === 0 && (
          <Text c='gray.5' fz='sm' p='sm' data-testid='collections-empty'>
            No collections match the current filters.
          </Text>
        )}
      </ScrollArea.Autosize>
    </Stack>
  );
}
