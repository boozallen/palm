import { useMemo } from 'react';
import { Box, Stack, Text, ScrollArea, UnstyledButton, Group, Badge } from '@mantine/core';
import { IconHistory } from '@tabler/icons-react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetMessages from '@/features/chat/api/get-messages';
import { GraphSearchResultData } from '@/features/chat/types/message';

type EvidenceHistoryItem = {
  messageId: string;
  questionMessageId: string;
  question: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: Date;
};

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncate(text: string, max = 120): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

/**
 * Timeline of every answer's evidence subgraph. Each new query replaces the live graph; this lists
 * the prior versions (already persisted per answer in `graphSearchResult`) and restores the chosen
 * one as the active, interactive graph (see `restoreEvidence`).
 */
export default function EvidenceHistory() {
  const { chatId, activeEvidenceMessageId, restoreEvidence, setScrollToMessageId } = useChat();
  const messagesQry = useGetMessages(chatId);

  const items = useMemo<EvidenceHistoryItem[]>(() => {
    const msgs = messagesQry.data?.messages;
    if (!msgs) {
      return [];
    }
    const result: EvidenceHistoryItem[] = [];
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.role !== 'assistant' || !m.graphSearchResult) {
        continue;
      }
      const ev = (m.graphSearchResult as GraphSearchResultData[]).find((d) => d.kind === 'evidence');
      if (!ev) {
        continue;
      }
      // The question that produced this evidence is the nearest preceding user message.
      let question = m.content;
      let questionMessageId = m.id;
      for (let j = i - 1; j >= 0; j--) {
        if (msgs[j].role === 'user') {
          question = msgs[j].content;
          questionMessageId = msgs[j].id;
          break;
        }
      }
      result.push({
        messageId: m.id,
        questionMessageId,
        question,
        nodeCount: ev.graphData?.nodes.length ?? ev.rowCount,
        edgeCount: ev.graphData?.edges.length ?? 0,
        createdAt: new Date(m.messagedAt),
      });
    }
    return result.reverse(); // newest first
  }, [messagesQry.data]);

  // Active = explicit restore override, otherwise the latest (first) answer.
  const activeId = activeEvidenceMessageId ?? items[0]?.messageId ?? null;

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
        <Text size='sm' fw={600}>Graph History</Text>
      </Group>
      <ScrollArea sx={{ flex: 1 }}>
        {items.length === 0 ? (
          <Box p='md'>
            <Text size='xs' color='dimmed'>
              No graph answers yet. Ask a question that builds an evidence graph and it will appear here.
            </Text>
          </Box>
        ) : (
          <Stack spacing={0}>
            {items.map((it) => {
              const isActive = it.messageId === activeId;
              return (
                <UnstyledButton
                  key={it.messageId}
                  onClick={() => {
                    restoreEvidence(it.messageId);
                    setScrollToMessageId(it.questionMessageId);
                  }}
                  sx={(theme) => ({
                    padding: theme.spacing.sm,
                    borderLeft: `2px solid ${isActive ? theme.colors.cyan[6] : 'transparent'}`,
                    backgroundColor: isActive ? theme.colors.dark[6] : 'transparent',
                    borderBottom: `1px solid ${theme.colors.dark[5]}`,
                    '&:hover': { backgroundColor: theme.colors.dark[5] },
                  })}
                >
                  <Group position='apart' noWrap align='flex-start'>
                    <Text size='sm' lineClamp={2}>
                      {truncate(it.question)}
                    </Text>
                    {isActive && (
                      <Badge size='xs' color='cyan' variant='filled' sx={{ flexShrink: 0 }}>
                        Active
                      </Badge>
                    )}
                  </Group>
                  <Group spacing={6} mt={4}>
                    <Badge size='xs' variant='light' color='cyan'>
                      {it.nodeCount} {it.nodeCount === 1 ? 'node' : 'nodes'}
                    </Badge>
                    <Badge size='xs' variant='light' color='gray'>
                      {it.edgeCount} {it.edgeCount === 1 ? 'edge' : 'edges'}
                    </Badge>
                    <Text size='xs' color='dimmed'>
                      {formatTimestamp(it.createdAt)}
                    </Text>
                  </Group>
                </UnstyledButton>
              );
            })}
          </Stack>
        )}
      </ScrollArea>
    </Box>
  );
}
