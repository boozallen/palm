import { Box, Button, CloseButton, Group, List, useMantineTheme } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

import { useChat } from '@/features/chat/providers/ChatProvider';
import useRetryMessage from '@/features/chat/api/retry-message';
import { EntryType, MessageEntry } from '@/features/chat/types/entry';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { SystemConfigFields } from '@/features/shared/types';
import { DefaultSystemMessage } from '@/features/shared/utils';
import SystemEntry from '@/features/chat/components/entries/SystemEntry';
import UserEntry from '@/features/chat/components/entries/UserEntry';
import AssistantEntry from '@/features/chat/components/entries/AssistantEntry';
import AssistantEntryDeepResearch from '@/features/chat/components/entries/AssistantEntryDeepResearch';
import RetryEntry from '@/features/chat/components/entries/RetryEntry';
import SkeletonEntry from '@/features/chat/components/entries/SkeletonEntry';
import { AsyncChatStatus, MessageRole } from '@/features/chat/types/message';
import useStickyBottom from '@/features/chat/hooks/useStickyBottom';
import { generateCitationUrl, generatePath } from '@/features/chat/utils/chatHelperFunctions';
import useDeselectDeletedArtifact from '@/features/chat/hooks/useDeselectDeletedArtifact';
import useFormatChatEntries from '@/features/chat/hooks/useFormatChatEntries';
import EmptyChatSuggestions from '@/features/chat/components/EmptyChatSuggestions';

type ChatContentProps = Readonly<{
  // Rendered inside the message scroll container so the scrollbar spans the
  // full pane height while the input stays pinned to the bottom.
  input?: React.ReactNode;
}>;

export default function ChatContent({ input }: ChatContentProps) {
  const {
    chatId,
    knowledgeBaseIds,
    documentIds,
    promptId,
    pendingMessage,
    selectedArtifact,
    regeneratingResponse,
    deepResearchEnabled,
    entryBeingEdited,
    setRegeneratingResponse,
    setIsLastMessageRetry,
    setSelectedArtifact,
    scrollToMessageId,
    setScrollToMessageId,
    showSystemEntry,
    setShowSystemEntry,
    sourcesSidebarExpanded,
    showKnowledgeGraph,
    showArtifactsContainer,
  } = useChat();

  const isCompact = sourcesSidebarExpanded || showKnowledgeGraph || showArtifactsContainer || !!selectedArtifact;
  const sidebarOnlyOpen = sourcesSidebarExpanded && !showKnowledgeGraph && !showArtifactsContainer && !selectedArtifact;

  const router = useRouter();
  const theme = useMantineTheme();
  const searchParams = useSearchParams();
  const promptIdFromQuery = searchParams.get('promptid');
  const citedMessageIdFromQuery = searchParams.get('cited_message_id');
  const returnChatIdFromQuery = searchParams.get('return_chat_id');
  const returnMessageIdFromQuery = searchParams.get('return_message_id');

  const { data: configData } = useGetSystemConfig();

  const systemMessage = configData?.[SystemConfigFields.SystemMessage] ?? DefaultSystemMessage;

  // retry the last message that returned an error from the AI source
  const retryMessage = useRetryMessage();

  const handleMessageRetry = async (index: number) => {
    if (index === 0) {
      return;
    }

    const messageToRetry = messages[index];

    // Replace retry entry with skeleton while awaiting response
    setRegeneratingResponse(true);
    await retryMessage.mutateAsync({ chatId: messageToRetry.chatId, knowledgeBaseIds, documentIds });
    setRegeneratingResponse(false);
  };

  // Combine messages data into list
  const messages = useFormatChatEntries(
    chatId,
    promptId,
    pendingMessage,
    systemMessage,
    regeneratingResponse,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isSystemEntryBeingEdited = entryBeingEdited &&
    messages.find(msg => msg.id === entryBeingEdited && msg.type === EntryType.Message && msg.role === MessageRole.System);

  // Check if chat is empty (only system messages, no user/assistant messages)
  const hasUserOrAssistantMessages = messages.some(
    (entry) =>
      entry.type === EntryType.Message &&
      (entry.role === MessageRole.User || entry.role === MessageRole.Assistant)
  );

  // Don't show empty state if:
  // 1. There's a chatId (saved chat)
  // 2. There's a promptId in the query string (loading a prompt)
  // 3. There are already messages
  const shouldShowEmptyState = !chatId && !hasUserOrAssistantMessages && !promptIdFromQuery;

  const isAnyProcessing = messages.some(
    entry => entry.type === EntryType.Message && (entry as MessageEntry).asyncChatStatus === AsyncChatStatus.PROCESSING,
  );

  // Autoscrolls to the bottom on new content, but only while the reader is already
  // there — stops fighting them the moment they scroll up to read earlier messages.
  const pinnedToBottomRef = useStickyBottom(scrollContainerRef, messagesEndRef, {
    active: !shouldShowEmptyState,
    streaming: isAnyProcessing,
    suspend: !!isSystemEntryBeingEdited,
    messages,
  });

  useDeselectDeletedArtifact(messages, selectedArtifact, () => setSelectedArtifact(null));

  // History → chat: scroll the chat to a requested message (the question behind a restored graph).
  // Entries carry their message id as data-testid, so we locate the row and scroll it into view.
  useEffect(() => {
    if (!scrollToMessageId) {
      return;
    }
    const el = document.querySelector(`[data-message-id="${scrollToMessageId}"]`);
    pinnedToBottomRef.current = false;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScrollToMessageId(null);
  }, [scrollToMessageId, setScrollToMessageId, pinnedToBottomRef]);

  // Citation → source chat: scroll to the cited message once its entry has
  // rendered. Retries across message loads (the target may not be in the DOM
  // yet on arrival) and runs once per id, so later autoscrolls behave normally.
  const handledCitedMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!citedMessageIdFromQuery || handledCitedMessageIdRef.current === citedMessageIdFromQuery) {
      return;
    }
    const el = document.querySelector(`[data-message-id="${citedMessageIdFromQuery}"]`);
    if (!el) {
      return;
    }
    handledCitedMessageIdRef.current = citedMessageIdFromQuery;
    // Centering the last message leaves the end of a long answer below the fold, so a
    // citation of the last message lands on the true bottom of the container instead.
    const isLastMessage = messages[messages.length - 1]?.id === citedMessageIdFromQuery;
    if (isLastMessage && messagesEndRef.current) {
      pinnedToBottomRef.current = true;
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      pinnedToBottomRef.current = false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    el.animate?.(
      [{ backgroundColor: theme.fn.rgba(theme.colors.blue[6], 0.25) }, { backgroundColor: 'transparent' }],
      { duration: 2000, easing: 'ease-out' },
    );
  }, [citedMessageIdFromQuery, messages, theme, pinnedToBottomRef]);

  const handleReturnToCitingChat = () => {
    if (!returnChatIdFromQuery) {
      return;
    }
    void router.push(generateCitationUrl(returnChatIdFromQuery, returnMessageIdFromQuery));
  };

  const handleDismissReturnPill = () => {
    if (chatId) {
      void router.replace(generatePath(chatId), undefined, { shallow: true });
    }
  };

  // If the last message is of entry.type 'Retry', an error has occurred getting a response from the AI source
  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;
  const isLastMessageRetry = lastMessage?.type === EntryType.Retry;

  // Set the ChatProvider context variable to allow disabling of MessageInput when the last message is a retry
  useEffect(() => {
    setIsLastMessageRetry(isLastMessageRetry);
  }, [isLastMessageRetry, setIsLastMessageRetry]);

  // Auto-show SystemEntry when loading a prompt via URL
  useEffect(() => {
    if (promptIdFromQuery) {
      setShowSystemEntry(true);
    }
  }, [promptIdFromQuery, setShowSystemEntry]);

  // Get system message entry for display
  const systemMessageEntry = messages.find(
    (entry): entry is MessageEntry => entry.type === EntryType.Message && entry.role === MessageRole.System
  );

  // Centering for the message content itself. The scroll container is always full
  // width so the scrollbar hugs the right edge of the chat pane (claude.ai style);
  // the content is what gets constrained + centered, not the scroll container.
  const contentWidthStyle: React.CSSProperties =
    !isCompact || sidebarOnlyOpen
      ? { maxWidth: 860, marginLeft: 'auto', marginRight: 'auto', width: '100%' }
      : { width: '100%' };

  return (
    <Box
      style={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      bg='dark.7'
    >
      {shouldShowEmptyState ? (
        <>
          {showSystemEntry && systemMessageEntry && (
            <Box style={contentWidthStyle}>
              <List>
                <SystemEntry entry={systemMessageEntry} key={`system-${systemMessageEntry.id}`} />
              </List>
            </Box>
          )}
          <Box style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <Box style={contentWidthStyle}>
              <EmptyChatSuggestions />
            </Box>
          </Box>
        </>
      ) : (
        <Box ref={scrollContainerRef} style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {returnChatIdFromQuery && (
            <Box style={{ position: 'sticky', top: theme.spacing.xs, zIndex: 10, alignSelf: 'center' }}>
              <Group
                spacing={4}
                bg='dark.5'
                px='xs'
                py={4}
                style={{ borderRadius: theme.radius.lg, boxShadow: theme.shadows.md }}
              >
                <Button
                  size='xs'
                  variant='subtle'
                  color='blue'
                  compact
                  leftIcon={<IconArrowLeft size={14} />}
                  onClick={handleReturnToCitingChat}
                  data-testid='citation-return-button'
                >
                  Return to chat
                </Button>
                <CloseButton
                  size='xs'
                  aria-label='Dismiss'
                  onClick={handleDismissReturnPill}
                  data-testid='citation-return-dismiss'
                />
              </Group>
            </Box>
          )}
          {/* Grows to fill so the input pins to the bottom even in short chats. */}
          <Box style={{ ...contentWidthStyle, flex: '1 0 auto' }}>
            <List>
            {messages.map((entry, index) => {
              const key = `${entry.type}-${entry.id}`;
              switch (entry.type) {
                case EntryType.Message:
                  switch (entry.role) {
                    case MessageRole.System:
                      return showSystemEntry ? <SystemEntry entry={entry} key={`system-${key}`} /> : null;
                    case MessageRole.User:
                      return (
                        <UserEntry
                          entry={entry}
                          key={`user-${key}`}
                        />
                      );
                    case MessageRole.Assistant:
                      const nextMessage = messages[index + 1];
                      const followUpReferencedInNextUserEntry =
                        (index < messages.length - 1 &&
                         nextMessage?.type === EntryType.Message &&
                         nextMessage.role === MessageRole.User &&
                         entry.followUps?.some(followUp =>
                           nextMessage.content === followUp.content
                         ));

                      if (entry.deepResearch) {
                        return (
                          <AssistantEntryDeepResearch
                            key={`deep-research-${key}`}
                            entry={entry}
                            isLatestResponse={index === messages.length - 1}
                            followUpReferencedInNextUserEntry={followUpReferencedInNextUserEntry}
                          />
                        );
                      } else {
                        return (
                          <AssistantEntry
                            key={`assistant-${key}`}
                            entry={entry}
                            isLatestResponse={index === messages.length - 1}
                            followUpReferencedInNextUserEntry={followUpReferencedInNextUserEntry}
                          />
                        );
                      }
                    default:
                      return null;
                  }
                case EntryType.Retry:
                  return (
                    <RetryEntry
                      entry={entry}
                      onRetry={() => handleMessageRetry(index)}
                      key={`retry-${key}`}
                    />
                  );
                case EntryType.Skeleton:
                  return <SkeletonEntry
                    entry={entry}
                    key={`skeleton-${key}`}
                    deepResearchEnabled={deepResearchEnabled}
                  />;
                default:
                  return null;
              }
            })}
            </List>
          </Box>
          {input && (
            <Box
              style={{ position: 'sticky', bottom: 0, width: '100%' }}
              bg='dark.7'
            >
              {input}
            </Box>
          )}
          {/* Sits below the sticky input so autoscroll lands on the true bottom
              of the scroll container, not the end of the message list. */}
          <div ref={messagesEndRef} />
        </Box>
      )}
    </Box>
  );
}
