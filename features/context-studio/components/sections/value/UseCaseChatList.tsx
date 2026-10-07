import { useState, useMemo, Fragment } from 'react';
import {
  Box,
  Table,
  Text,
  Pagination,
  Stack,
  Skeleton,
  UnstyledButton,
  Group,
  useMantineTheme,
} from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { UseCaseChatRow } from '@/features/context-studio/types/use-case-detail';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import useGetChatTranscript from '@/features/context-studio/api/get-chat-transcript';
import ChatTranscript from '@/features/context-studio/components/ChatTranscript';
import { UseCase } from '@/features/shared/types/use-case';
import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';
import { formatCount } from '@/features/context-studio/utils/valueFormat';

const PAGE_SIZE = 25;

type SortColumn = 'cost' | 'artifacts' | 'putToWork';
type SortDirection = 'asc' | 'desc';

type SortState = {
  column: SortColumn;
  direction: SortDirection;
};

type UseCaseChatListProps = {
  chats: UseCaseChatRow[];
  totalChats: number;
  // The drawer's filters, forwarded so the transcript request can be checked
  // against the same scope this list was selected under.
  useCase: UseCase;
  timeRange: TimeRange;
  userGroupId: string;
  userId: string;
};

export default function UseCaseChatList({
  chats,
  totalChats,
  useCase,
  timeRange,
  userGroupId,
  userId,
}: UseCaseChatListProps) {
  const theme = useMantineTheme();
  const [sortState, setSortState] = useState<SortState>({
    column: 'cost',
    direction: 'desc',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedChatId, setExpandedChatId] = useState<string | null>(null);

  const transcriptQuery = useGetChatTranscript(
    expandedChatId,
    useCase,
    timeRange,
    userGroupId,
    userId,
    expandedChatId !== null,
  );

  const sortedChats = useMemo(() => {
    const sorted = [...chats].sort((a, b) => {
      const { column, direction } = sortState;
      const aVal = a[column];
      const bVal = b[column];

      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return direction === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [chats, sortState]);

  const paginatedChats = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedChats.slice(start, start + PAGE_SIZE);
  }, [sortedChats, currentPage]);

  const totalPages = Math.ceil(sortedChats.length / PAGE_SIZE);

  const handleSort = (column: SortColumn) => {
    setSortState((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
      }
      return { column, direction: 'desc' };
    });
    setCurrentPage(1);
  };

  const handleRowClick = (chatId: string) => {
    setExpandedChatId((prev) => (prev === chatId ? null : chatId));
  };

  const handleRowKeyDown = (event: React.KeyboardEvent, chatId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRowClick(chatId);
    }
  };

  const SortButton = ({
    column,
    label,
    testId,
  }: {
    column: SortColumn;
    label: string;
    testId: string;
  }) => {
    const isActive = sortState.column === column;
    return (
      <UnstyledButton onClick={() => handleSort(column)} data-testid={testId}>
        <Group spacing='xxs'>
          <Text
            size='xs'
            weight={theme.other.fontWeights.medium}
            c={isActive ? 'white' : 'gray.5'}
            tt='uppercase'
          >
            {label}
          </Text>
          {isActive && (
            sortState.direction === 'desc' ? (
              <IconChevronDown size={12} />
            ) : (
              <IconChevronUp size={12} />
            )
          )}
        </Group>
      </UnstyledButton>
    );
  };

  return (
    <Stack spacing='md'>
      {totalChats > chats.length && (
        <Text size='xxs' c='dimmed' data-testid='use-case-chat-cap'>
          showing the {formatCount(chats.length)} largest by spend of {formatCount(totalChats)} chats
        </Text>
      )}

      <Table>
        <thead>
          <tr>
            <th>
              <Text size='xs' weight={theme.other.fontWeights.medium} c='gray.5' tt='uppercase'>
                Title
              </Text>
            </th>
            <th>
              <Text size='xs' weight={theme.other.fontWeights.medium} c='gray.5' tt='uppercase'>
                Owner
              </Text>
            </th>
            <th>
              <SortButton column='cost' label='Spend' testId='use-case-chat-sort-spend' />
            </th>
            <th>
              <SortButton column='artifacts' label='Made' testId='use-case-chat-sort-made' />
            </th>
            <th>
              <SortButton column='putToWork' label='Used' testId='use-case-chat-sort-used' />
            </th>
          </tr>
        </thead>
        <tbody>
          {paginatedChats.map((chat) => {
            const isExpanded = expandedChatId === chat.chatId;
            return (
              <Fragment key={chat.chatId}>
                <Box
                  component='tr'
                  role='button'
                  tabIndex={0}
                  onClick={() => handleRowClick(chat.chatId)}
                  onKeyDown={(e: React.KeyboardEvent) => handleRowKeyDown(e, chat.chatId)}
                  data-testid='use-case-chat-row'
                  sx={{ cursor: 'pointer' }}
                >
                  <td>
                    <Text size='sm' data-testid='use-case-chat-title'>
                      {chat.title ?? '(untitled chat)'}
                    </Text>
                  </td>
                  <td>
                    <Text size='sm' c='gray.4'>
                      {chat.ownerName ?? chat.ownerEmail ?? 'Unknown'}
                    </Text>
                  </td>
                  <td>
                    <Text size='sm'>{formatCurrencyNumberForAnalytics(chat.cost)}</Text>
                  </td>
                  <td>
                    <Text size='sm'>{formatCount(chat.artifacts)}</Text>
                  </td>
                  <td>
                    <Text size='sm'>{formatCount(chat.putToWork)}</Text>
                  </td>
                </Box>
                {isExpanded && (
                  <tr>
                    <Box
                      component='td'
                      colSpan={5}
                      p='md'
                      bg='dark.7'
                    >
                      {transcriptQuery.isError ? (
                        <Text size='xs' c='dimmed' data-testid='use-case-chat-transcript-error'>
                          couldn&apos;t load this transcript
                        </Text>
                      ) : transcriptQuery.isLoading ? (
                        <Stack spacing='sm'>
                          <Skeleton height={60} />
                          <Skeleton height={60} />
                          <Skeleton height={60} />
                        </Stack>
                      ) : transcriptQuery.data ? (
                        <ChatTranscript
                          messages={transcriptQuery.data}
                          userName={chat.ownerName}
                        />
                      ) : null}
                    </Box>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </Table>

      {totalPages > 1 && (
        <Pagination
          value={currentPage}
          onChange={setCurrentPage}
          total={totalPages}
          size='sm'
        />
      )}
    </Stack>
  );
}
