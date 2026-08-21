import { Box, List } from '@mantine/core';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

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
import { MessageRole } from '@/features/chat/types/message';
import useScrollIntoView from '@/features/shared/hooks/useScrollIntoView';
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

  const searchParams = useSearchParams();
  const promptIdFromQuery = searchParams.get('promptid');

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
  
  const isSystemEntryBeingEdited = entryBeingEdited &&
    messages.find(msg => msg.id === entryBeingEdited && msg.type === EntryType.Message && msg.role === MessageRole.System);
  // Only autoscroll when NOT editing a system entry
  useScrollIntoView(messagesEndRef, isSystemEntryBeingEdited ? [] : [messages]);

  useDeselectDeletedArtifact(messages, selectedArtifact, () => setSelectedArtifact(null));

  // History → chat: scroll the chat to a requested message (the question behind a restored graph).
  // Entries carry their message id as data-testid, so we locate the row and scroll it into view.
  useEffect(() => {
    if (!scrollToMessageId) {
      return;
    }
    const el = document.querySelector(`[data-testid="${scrollToMessageId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScrollToMessageId(null);
  }, [scrollToMessageId, setScrollToMessageId]);

  // If the last message is of entry.type 'Retry', an error has occurred getting a response from the AI source
  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;
  const isLastMessageRetry = lastMessage?.type === EntryType.Retry;

  // Set the ChatProvider context variable to allow disabling of MessageInput when the last message is a retry
  useEffect(() => {
    setIsLastMessageRetry(isLastMessageRetry);
  }, [isLastMessageRetry, setIsLastMessageRetry]);

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
        <Box style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
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
