import { Box, List } from '@mantine/core';
import { useEffect, useRef } from 'react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import useRetryMessage from '@/features/chat/api/retry-message';
import { EntryType } from '@/features/chat/types/entry';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { SystemConfigFields } from '@/features/shared/types';
import { DefaultSystemMessage } from '@/features/shared/utils';
import SystemEntry from '@/features/chat/components/entries/SystemEntry';
import UserEntry from '@/features/chat/components/entries/UserEntry';
import AssistantEntry from '@/features/chat/components/entries/AssistantEntry';
import RetryEntry from '@/features/chat/components/entries/RetryEntry';
import SkeletonEntry from '@/features/chat/components/entries/SkeletonEntry';
import { MessageRole } from '@/features/chat/types/message';
import useScrollIntoView from '@/features/shared/hooks/useScrollIntoView';
import useDeselectDeletedArtifact from '@/features/chat/hooks/useDeselectDeletedArtifact';
import useFormatChatEntries from '@/features/chat/hooks/useFormatChatEntries';

export default function ChatContent() {
  const {
    chatId,
    knowledgeBaseIds,
    documentLibraryEnabled,
    promptId,
    pendingMessage,
    selectedArtifact,
    regeneratingResponse,
    setRegeneratingResponse,
    setIsLastMessageRetry,
    setSelectedArtifact,
  } = useChat();

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
    await retryMessage.mutateAsync({ chatId: messageToRetry.chatId, knowledgeBaseIds, documentLibraryEnabled });
    setRegeneratingResponse(false);
  };

  // Combine messages data into list
  const messages = useFormatChatEntries(
    chatId,
    promptId,
    pendingMessage,
    systemMessage,
    regeneratingResponse
  );

  const messagesEndRef = useRef<HTMLOListElement>(null);
  useScrollIntoView(messagesEndRef, [messages]);

  useDeselectDeletedArtifact(messages, selectedArtifact, () => setSelectedArtifact(null));

  // If the last message is of entry.type 'Retry', an error has occurred getting a response from the AI source
  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;
  const isLastMessageRetry = lastMessage?.type === EntryType.Retry;

  // Set the ChatProvider context variable to allow disabling of MessageInput when the last message is a retry
  useEffect(() => {
    setIsLastMessageRetry(isLastMessageRetry);
  }, [isLastMessageRetry, setIsLastMessageRetry]);

  return (
    <Box
      style={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        ...(selectedArtifact && {
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
        }),
      }}
      bg='dark.7'
    >
      <Box style={{ overflow: 'auto', flex: 1 }}>
        <List ref={messagesEndRef}>
          {messages.map((entry, index) => {
            const key = `${entry.type}-${entry.id}`;
            switch (entry.type) {
              case EntryType.Message:
                switch (entry.role) {
                  case MessageRole.System:
                    return <SystemEntry entry={entry} key={`system-${key}`} />;
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
                    return (
                      <AssistantEntry
                        key={`assistant-${key}`}
                        entry={entry}
                        isLatestResponse={index === messages.length - 1}
                        followUpReferencedInNextUserEntry={followUpReferencedInNextUserEntry}
                      />
                    );
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
                return <SkeletonEntry entry={entry} key={`skeleton-${key}`} />;
              default:
                return null;
            }
          })}
        </List>
      </Box>
    </Box>
  );
}
