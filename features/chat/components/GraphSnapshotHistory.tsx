import { useMemo } from 'react';
import { Box, Stack, Text, ScrollArea, UnstyledButton, Group, Badge, Tooltip } from '@mantine/core';
import { IconHistory, IconChevronLeft } from '@tabler/icons-react';
import { ActionIcon } from '@mantine/core';

import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetMessages from '@/features/chat/api/get-messages';
import { trpc } from '@/libs';
import SnapshotGraphView from '@/features/chat/components/SnapshotGraphView';

type SnapshotListItem = {
  snapshotId: string;
  questionContent: string;
  nodeCount: number;
  createdAt: Date;
};

function formatTimestamp(date: Date): string {
  const d = new Date(date);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max - 1) + '…';
}

export default function GraphSnapshotHistory() {
  const {
    chatId,
    graphHistoryPanelOpen,
    selectedGraphSnapshotId,
    openGraphSnapshot,
    setSelectedGraphSnapshotId,
  } = useChat();

  const messagesQry = useGetMessages(chatId);

  const snapshots = useMemo<SnapshotListItem[]>(() => {
    if (!messagesQry.data) {
      return [];
    }
    return messagesQry.data.messages
      .filter((m) => m.graphSnapshot != null)
      .map((m) => ({
        snapshotId: m.graphSnapshot!.id,
        questionContent: m.content,
        nodeCount: m.graphSnapshot!.nodeIds.length,
        createdAt: new Date(m.graphSnapshot!.createdAt),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [messagesQry.data]);

  const snapshotGraphQry = trpc.chat.getSnapshotGraph.useQuery(
    { snapshotId: selectedGraphSnapshotId ?? '' },
    { enabled: !!selectedGraphSnapshotId },
  );

  if (!graphHistoryPanelOpen && !selectedGraphSnapshotId) {
    return null;
  }

  // Banner above SnapshotGraphPane when a snapshot is selected.
  if (selectedGraphSnapshotId) {
    const question = snapshotGraphQry.data?.snapshot.questionContent ?? '…';
    const nodeCount = snapshotGraphQry.data?.metadata.nodeCount ?? 0;
    const edgeCount = snapshotGraphQry.data?.metadata.edgeCount ?? 0;
    const createdAt = snapshotGraphQry.data
      ? new Date(snapshotGraphQry.data.snapshot.createdAt)
      : null;

    return (
      <Group
        spacing='sm'
        noWrap
        px='md'
        py='xs'
        sx={(theme) => ({
          backgroundColor: theme.colors.dark[6],
          borderBottom: `1px solid ${theme.colors.dark[5]}`,
          flexShrink: 0,
          minWidth: 0,
        })}
      >
        <Tooltip label='Back to history list' position='bottom'>
          <ActionIcon
            size='sm'
            variant='subtle'
            onClick={() => setSelectedGraphSnapshotId(null)}
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
        </Tooltip>
        <Text size='xs' color='dimmed' sx={{ flexShrink: 0 }}>
          Snapshot of
        </Text>
        <Text
          size='sm'
          fw={500}
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
          }}
        >
          {truncate(question, 100)}
        </Text>
        <Group spacing={6} noWrap sx={{ flexShrink: 0 }}>
          <Badge size='xs' variant='light' color='cyan'>
            {nodeCount} nodes
          </Badge>
          <Badge size='xs' variant='light' color='gray'>
            {edgeCount} edges
          </Badge>
          {createdAt && (
            <Text size='xs' color='dimmed'>
              {formatTimestamp(createdAt)}
            </Text>
          )}
        </Group>
      </Group>
    );
  }

  // List state — fills the pane.
  return (
    <Box
      sx={(theme) => ({
        width: '100%',
        height: '100%',
        backgroundColor: theme.colors.dark[7],
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <Group
        spacing={6}
        px='md'
        py='xs'
        sx={(theme) => ({ borderBottom: `1px solid ${theme.colors.dark[5]}`, flexShrink: 0 })}
      >
        <IconHistory size={16} />
        <Text size='sm' fw={600}>Snapshot History</Text>
      </Group>
      <ScrollArea sx={{ flex: 1 }}>
        {snapshots.length === 0 ? (
          <Box p='md'>
            <Text size='xs' color='dimmed'>
              No snapshots yet. Submit a graph-scoped question to capture the canvas state.
            </Text>
          </Box>
        ) : (
          <Stack spacing={0}>
            {snapshots.map((s) => (
              <UnstyledButton
                key={s.snapshotId}
                onClick={() => openGraphSnapshot(s.snapshotId)}
                sx={(theme) => ({
                  padding: theme.spacing.sm,
                  borderBottom: `1px solid ${theme.colors.dark[5]}`,
                  '&:hover': { backgroundColor: theme.colors.dark[5] },
                })}
              >
                <Text size='sm' lineClamp={2}>
                  {truncate(s.questionContent, 120)}
                </Text>
                <Group spacing={6} mt={4}>
                  <Badge size='xs' variant='light' color='cyan'>
                    {s.nodeCount} {s.nodeCount === 1 ? 'node' : 'nodes'}
                  </Badge>
                  <Text size='xs' color='dimmed'>
                    {formatTimestamp(s.createdAt)}
                  </Text>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </ScrollArea>
    </Box>
  );
}

export function SnapshotGraphPane() {
  const { selectedGraphSnapshotId } = useChat();

  const snapshotGraphQry = trpc.chat.getSnapshotGraph.useQuery(
    { snapshotId: selectedGraphSnapshotId ?? '' },
    { enabled: !!selectedGraphSnapshotId },
  );

  if (!selectedGraphSnapshotId) {
    return null;
  }

  if (snapshotGraphQry.isLoading || !snapshotGraphQry.data) {
    return (
      <Box p='md'>
        <Text size='sm' color='dimmed'>Loading snapshot…</Text>
      </Box>
    );
  }

  if (snapshotGraphQry.error) {
    return (
      <Box p='md'>
        <Text size='sm' color='red'>
          Failed to load snapshot: {snapshotGraphQry.error.message}
        </Text>
      </Box>
    );
  }

  return (
    <SnapshotGraphView
      nodes={snapshotGraphQry.data.nodes}
      edges={snapshotGraphQry.data.edges}
      height='100%'
    />
  );
}
